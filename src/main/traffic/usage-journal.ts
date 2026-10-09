// Data-usage dimensions and drill-down adapted from MetaCubeX/metacubexd useDataUsage.
// Sampling runs in Sparkle's main process so it survives page changes and window closure.
import type {
  UsageStorage,
  UsageQuery,
  UsageRecord,
  UsageResult,
  UsageEntry,
  UsageDimension
} from '../../shared/types/traffic'
const dimensions: UsageDimension[] = ['sourceIP', 'inboundUser', 'host', 'outbound', 'process']
export class UsageJournal {
  private data: UsageStorage
  private buckets = new Map<string, UsageRecord>()
  private bucketMinute = 0
  private lastPrune = 0
  constructor(saved?: UsageStorage) {
    this.data = saved ?? {
      records: [],
      baseline: {},
      retention: 30 * 86400000,
      startedAt: Date.now()
    }
    this.bucketMinute = Math.max(0, ...this.data.records.slice(-1).map((record) => record.time))
    this.data.records
      .filter((record) => record.time === this.bucketMinute)
      .forEach((record) => {
        this.buckets.set(
          JSON.stringify([record.time, record.id, ...dimensions.map((d) => record[d])]),
          record
        )
      })
  }
  feed(snapshot: ControllerConnections, now: number, instanceId?: string): void {
    const minute = Math.floor(now / 60000) * 60000
    if (minute !== this.bucketMinute) {
      this.buckets.clear()
      this.bucketMinute = minute
    }
    const changed = instanceId !== this.data.instanceId
    if (changed) {
      this.data.baseline = {}
      this.data.instanceId = instanceId
    }
    const first = !this.data.initialized || changed
    const next: UsageStorage['baseline'] = Object.fromEntries(
      Object.entries(this.data.baseline).filter(
        ([, counter]) => now - (counter.lastSeen ?? now) <= 5000
      )
    )
    for (const connection of snapshot.connections ?? []) {
      const previous = this.data.baseline[connection.id]
      const upload = Math.max(
        0,
        connection.upload - (previous?.upload ?? (first ? connection.upload : 0))
      )
      const download = Math.max(
        0,
        connection.download - (previous?.download ?? (first ? connection.download : 0))
      )
      next[connection.id] = {
        upload: connection.upload,
        download: connection.download,
        lastSeen: now
      }
      if (!upload && !download) continue
      const meta = connection.metadata
      const record: UsageRecord = {
        time: Math.floor(now / 60000) * 60000,
        id: connection.id,
        sourceIP: meta.sourceIP || '未知设备',
        inboundUser:
          meta.inboundUser || meta.inboundIP || meta.inboundName || meta.type || '未认证用户',
        host: meta.host || meta.destinationIP || '未知目标',
        outbound: connection.chains?.[0] || 'DIRECT',
        process: meta.process || meta.processPath?.split(/[/\\]/).pop() || '未知进程',
        upload,
        download
      }
      const key = JSON.stringify([record.time, record.id, ...dimensions.map((d) => record[d])])
      const existing = this.buckets.get(key)
      if (existing) {
        existing.upload += upload
        existing.download += download
      } else {
        this.buckets.set(key, record)
        this.data.records.push(record)
      }
    }
    this.data.initialized = true
    this.data.baseline = next
    if (now - this.lastPrune >= 60000) {
      this.prune(now)
      this.lastPrune = now
    }
  }
  private prune(now: number): void {
    if (this.data.retention < 0) return
    const cutoff = now - this.data.retention
    if (!this.data.records.some((record) => record.time < cutoff)) return
    this.data.records = this.data.records.filter((record) => record.time >= cutoff)
    for (const [key, record] of this.buckets) if (record.time < cutoff) this.buckets.delete(key)
  }
  setRetention(retention: number, now = Date.now()): void {
    if (![-1, 3600000, 86400000, 604800000, 2592000000].includes(retention))
      throw new Error('无效的数据保留时长')
    this.data.retention = retention
    this.prune(now)
  }
  query(query: UsageQuery): UsageResult {
    if (
      !Number.isFinite(query.start) ||
      !Number.isFinite(query.end) ||
      query.start >= query.end ||
      !dimensions.includes(query.dimension)
    )
      throw new Error('无效的用量查询')
    const filtered = this.data.records.filter(
      (record) =>
        record.time >= query.start &&
        record.time <= query.end &&
        Object.entries(query.filters ?? {}).every(
          ([key, value]) => dimensions.includes(key as UsageDimension) && record[key] === value
        )
    )
    const entries = new Map<string, UsageEntry>()
    const ids = new Map<string, Set<string>>()
    const trends = new Map<number, { time: number; upload: number; download: number }>()
    const span = query.end - query.start
    const bucket =
      span <= 3600000 ? 60000 : span <= 86400000 ? 300000 : span <= 604800000 ? 3600000 : 86400000
    let totalUpload = 0,
      totalDownload = 0
    for (const record of filtered) {
      const label = record[query.dimension]
      const entry = entries.get(label) ?? { label, upload: 0, download: 0, total: 0, count: 0 }
      entry.upload += record.upload
      entry.download += record.download
      entry.total += record.upload + record.download
      const connections = ids.get(label) ?? new Set<string>()
      connections.add(record.id)
      ids.set(label, connections)
      entry.count = connections.size
      entries.set(label, entry)
      totalUpload += record.upload
      totalDownload += record.download
      const time = Math.floor(record.time / bucket) * bucket
      const trend = trends.get(time) ?? { time, upload: 0, download: 0 }
      trend.upload += record.upload
      trend.download += record.download
      trends.set(time, trend)
    }
    const trend: UsageResult['trend'] = []
    for (let time = Math.floor(query.start / bucket) * bucket; time <= query.end; time += bucket) {
      trend.push(trends.get(time) ?? { time, upload: 0, download: 0 })
      if (trend.length >= 1000) break
    }
    return {
      entries: [...entries.values()].sort((a, b) => b.total - a.total),
      trend,
      totalUpload,
      totalDownload,
      count: new Set(filtered.map((r) => r.id)).size,
      retention: this.data.retention,
      startedAt: this.data.startedAt
    }
  }
  clear(now = Date.now()): void {
    this.data.records = []
    this.buckets.clear()
    this.data.startedAt = now
  }
  serialize(): UsageStorage {
    return this.data
  }
}
