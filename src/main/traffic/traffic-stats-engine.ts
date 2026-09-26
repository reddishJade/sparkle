import type {
  CheckpointConnection,
  DayTrafficStats,
  TrafficStatsStorage,
  TrafficStatsSummary,
  TrafficSummaryItem,
  TrafficTimeRange
} from '../../shared/types/traffic'

export function formatLocalDate(timestamp: number): string {
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseChains(chains?: string[]): { node: string; group: string; chains: string[] } {
  if (!chains || chains.length === 0) {
    return { node: 'DIRECT', group: 'DIRECT', chains: ['DIRECT'] }
  }
  const validChains = chains.map((c) => (c ? c.trim() : '')).filter(Boolean)
  if (validChains.length === 0) {
    return { node: 'DIRECT', group: 'DIRECT', chains: ['DIRECT'] }
  }
  const node = validChains[0]
  const group = validChains[validChains.length - 1]
  return { node, group, chains: validChains }
}

interface ActiveConnectionState {
  upload: number
  download: number
  node: string
  group: string
  chains: string[]
  lastSeen: number
}

export class TrafficStatsEngine {
  private data: TrafficStatsStorage
  private sessionStats: DayTrafficStats = {
    day: 'session',
    uploadTotal: 0,
    downloadTotal: 0,
    attributedUpload: 0,
    attributedDownload: 0,
    rawGlobalUpload: 0,
    rawGlobalDownload: 0,
    unknownUpload: 0,
    unknownDownload: 0,
    records: {}
  }
  private activeConns = new Map<string, ActiveConnectionState>()
  private lastGlobalUp: number | null = null
  private lastGlobalDown: number | null = null
  private currentCoreInstanceId: string | undefined = undefined
  private dirty = false
  public connectionGracePeriodMs: number

  constructor(
    initialData?: Partial<TrafficStatsStorage>,
    options?: { connectionGracePeriodMs?: number }
  ) {
    this.connectionGracePeriodMs = options?.connectionGracePeriodMs ?? 5000
    this.data = {
      version: 1,
      checkpoint: {
        coreInstanceId: initialData?.checkpoint?.coreInstanceId,
        lastCoreUploadTotal: initialData?.checkpoint?.lastCoreUploadTotal ?? 0,
        lastCoreDownloadTotal: initialData?.checkpoint?.lastCoreDownloadTotal ?? 0,
        lastTimestamp: initialData?.checkpoint?.lastTimestamp ?? 0,
        activeConnections: initialData?.checkpoint?.activeConnections
          ? { ...initialData.checkpoint.activeConnections }
          : undefined
      },
      days: initialData?.days ? { ...initialData.days } : {}
    }

    // 兼容可能存在的旧存储结构字段初始化
    for (const dayStats of Object.values(this.data.days)) {
      this.ensureDayStatsStructure(dayStats)
    }
  }

  private ensureDayStatsStructure(dayStats: DayTrafficStats): void {
    if (dayStats.attributedUpload === undefined || dayStats.attributedDownload === undefined) {
      let sumUp = 0
      let sumDown = 0
      for (const rec of Object.values(dayStats.records || {})) {
        sumUp += rec.upload
        sumDown += rec.download
      }
      dayStats.attributedUpload = sumUp
      dayStats.attributedDownload = sumDown
      dayStats.rawGlobalUpload = dayStats.uploadTotal ?? sumUp + (dayStats.unknownUpload ?? 0)
      dayStats.rawGlobalDownload = dayStats.downloadTotal ?? sumDown + (dayStats.unknownDownload ?? 0)
    }
  }

  public isDirty(): boolean {
    return this.dirty
  }

  public markClean(): void {
    this.dirty = false
  }

  public getRawData(): TrafficStatsStorage {
    return this.data
  }

  private getOrCreateDayStats(dayStr: string): DayTrafficStats {
    if (!this.data.days[dayStr]) {
      this.data.days[dayStr] = {
        day: dayStr,
        uploadTotal: 0,
        downloadTotal: 0,
        attributedUpload: 0,
        attributedDownload: 0,
        rawGlobalUpload: 0,
        rawGlobalDownload: 0,
        unknownUpload: 0,
        unknownDownload: 0,
        records: {}
      }
      this.dirty = true
    } else {
      this.ensureDayStatsStructure(this.data.days[dayStr])
    }
    return this.data.days[dayStr]
  }

  private recalculateTotals(dayStats: DayTrafficStats): void {
    dayStats.uploadTotal = Math.max(dayStats.rawGlobalUpload, dayStats.attributedUpload)
    dayStats.downloadTotal = Math.max(dayStats.rawGlobalDownload, dayStats.attributedDownload)
    dayStats.unknownUpload = Math.max(0, dayStats.uploadTotal - dayStats.attributedUpload)
    dayStats.unknownDownload = Math.max(0, dayStats.downloadTotal - dayStats.attributedDownload)
  }

  private dumpActiveConnections(): Record<string, CheckpointConnection> {
    const res: Record<string, CheckpointConnection> = {}
    for (const [id, state] of this.activeConns.entries()) {
      res[id] = {
        upload: state.upload,
        download: state.download,
        chains: state.chains
      }
    }
    return res
  }

  public feedSnapshot(
    snapshot: {
      uploadTotal: number
      downloadTotal: number
      connections?: ControllerConnectionDetail[]
    },
    now: number = Date.now(),
    coreInstanceId?: string
  ): void {
    const rawConns = snapshot.connections || []
    const dayStr = formatLocalDate(now)
    const dayStats = this.getOrCreateDayStats(dayStr)

    // 场景 1：引擎冷启动（尚未建立首次采样基线）
    if (this.lastGlobalUp === null || this.lastGlobalDown === null) {
      this.currentCoreInstanceId = coreInstanceId
      const {
        coreInstanceId: savedInstanceId,
        lastCoreUploadTotal,
        lastCoreDownloadTotal,
        lastTimestamp,
        activeConnections: savedActiveConns
      } = this.data.checkpoint

      // 严格同时检查 upload 和 download 单调递增
      const countersMonotonic =
        snapshot.uploadTotal >= lastCoreUploadTotal &&
        snapshot.downloadTotal >= lastCoreDownloadTotal

      // 实例一致性验证：若记录了 instanceId 则必须匹配；若未记录 instanceId 则依赖双计数器单调递增
      const isSameInstance = Boolean(
        lastTimestamp > 0 &&
          countersMonotonic &&
          (savedInstanceId && coreInstanceId
            ? savedInstanceId === coreInstanceId
            : true)
      )

      if (isSameInstance) {
        const gapUp = Math.max(0, snapshot.uploadTotal - lastCoreUploadTotal)
        const gapDown = Math.max(0, snapshot.downloadTotal - lastCoreDownloadTotal)

        let offlineAttributedUp = 0
        let offlineAttributedDown = 0

        // 若 checkpoint 中持久化了退出时的活跃连接，比对当前存活连接，将离线期间由存活连接产生的增量归属到原节点/策略组
        if (savedActiveConns) {
          for (const conn of rawConns) {
            const prev = savedActiveConns[conn.id]
            if (prev) {
              const connUpDelta = Math.max(0, conn.upload - prev.upload)
              const connDownDelta = Math.max(0, conn.download - prev.download)

              if (connUpDelta > 0 || connDownDelta > 0) {
                offlineAttributedUp += connUpDelta
                offlineAttributedDown += connDownDelta

                const { node, group, chains } = parseChains(conn.chains || prev.chains)
                const recordKey = `${node}:::${group}:::${chains.join('>')}`
                let record = dayStats.records[recordKey]
                if (!record) {
                  record = {
                    node,
                    group,
                    chains,
                    upload: 0,
                    download: 0
                  }
                  dayStats.records[recordKey] = record
                }
                record.upload += connUpDelta
                record.download += connDownDelta
              }
            }
          }
        }

        if (gapUp > 0 || gapDown > 0 || offlineAttributedUp > 0 || offlineAttributedDown > 0) {
          dayStats.attributedUpload += offlineAttributedUp
          dayStats.attributedDownload += offlineAttributedDown
          dayStats.rawGlobalUpload += gapUp
          dayStats.rawGlobalDownload += gapDown
          this.recalculateTotals(dayStats)
          this.dirty = true
        }
      }

      // 将当前快照中的存活连接作为初始基准存入，本轮 delta 计 0，防止重复累计历史流量
      this.activeConns.clear()
      for (const conn of rawConns) {
        const { node, group, chains } = parseChains(conn.chains)
        this.activeConns.set(conn.id, {
          upload: Math.max(0, conn.upload),
          download: Math.max(0, conn.download),
          node,
          group,
          chains,
          lastSeen: now
        })
      }

      this.lastGlobalUp = Math.max(0, snapshot.uploadTotal)
      this.lastGlobalDown = Math.max(0, snapshot.downloadTotal)
      this.data.checkpoint = {
        coreInstanceId,
        lastCoreUploadTotal: this.lastGlobalUp,
        lastCoreDownloadTotal: this.lastGlobalDown,
        lastTimestamp: now,
        activeConnections: this.dumpActiveConnections()
      }
      this.dirty = true
      return
    }

    // 场景 2：运行中检测到 Mihomo Core 重启或实例切换
    const instanceChanged = Boolean(
      coreInstanceId &&
        this.currentCoreInstanceId &&
        coreInstanceId !== this.currentCoreInstanceId
    )
    const countersReset =
      snapshot.uploadTotal < this.lastGlobalUp ||
      snapshot.downloadTotal < this.lastGlobalDown

    if (instanceChanged || countersReset) {
      this.currentCoreInstanceId = coreInstanceId
      this.activeConns.clear()
      for (const conn of rawConns) {
        const { node, group, chains } = parseChains(conn.chains)
        this.activeConns.set(conn.id, {
          upload: Math.max(0, conn.upload),
          download: Math.max(0, conn.download),
          node,
          group,
          chains,
          lastSeen: now
        })
      }

      this.lastGlobalUp = Math.max(0, snapshot.uploadTotal)
      this.lastGlobalDown = Math.max(0, snapshot.downloadTotal)
      this.data.checkpoint = {
        coreInstanceId,
        lastCoreUploadTotal: this.lastGlobalUp,
        lastCoreDownloadTotal: this.lastGlobalDown,
        lastTimestamp: now,
        activeConnections: this.dumpActiveConnections()
      }
      this.dirty = true
      return
    }

    // 场景 3：正常连续采样
    const globalUpDelta = Math.max(0, snapshot.uploadTotal - this.lastGlobalUp)
    const globalDownDelta = Math.max(0, snapshot.downloadTotal - this.lastGlobalDown)

    const currentConnIds = new Set<string>()
    let sumConnUpDelta = 0
    let sumConnDownDelta = 0

    for (const conn of rawConns) {
      currentConnIds.add(conn.id)
      const { node, group, chains } = parseChains(conn.chains)
      const prev = this.activeConns.get(conn.id)

      let connUpDelta: number
      let connDownDelta: number

      if (prev) {
        // 已跟踪连接（包括暂时缺失但仍处于 Grace Period 内重新出现的连接）
        connUpDelta = Math.max(0, conn.upload - prev.upload)
        connDownDelta = Math.max(0, conn.download - prev.download)
        prev.upload = Math.max(0, conn.upload)
        prev.download = Math.max(0, conn.download)
        prev.node = node
        prev.group = group
        prev.chains = chains
        prev.lastSeen = now
      } else {
        // 新连接首次出现
        connUpDelta = Math.max(0, conn.upload)
        connDownDelta = Math.max(0, conn.download)
        this.activeConns.set(conn.id, {
          upload: Math.max(0, conn.upload),
          download: Math.max(0, conn.download),
          node,
          group,
          chains,
          lastSeen: now
        })
      }

      if (connUpDelta > 0 || connDownDelta > 0) {
        sumConnUpDelta += connUpDelta
        sumConnDownDelta += connDownDelta

        const recordKey = `${node}:::${group}:::${chains.join('>')}`
        let record = dayStats.records[recordKey]
        if (!record) {
          record = {
            node,
            group,
            chains,
            upload: 0,
            download: 0
          }
          dayStats.records[recordKey] = record
        }
        record.upload += connUpDelta
        record.download += connDownDelta

        let sessionRecord = this.sessionStats.records[recordKey]
        if (!sessionRecord) {
          sessionRecord = {
            node,
            group,
            chains,
            upload: 0,
            download: 0
          }
          this.sessionStats.records[recordKey] = sessionRecord
        }
        sessionRecord.upload += connUpDelta
        sessionRecord.download += connDownDelta
        this.dirty = true
      }
    }

    // 清理已超过 Grace Period 的关闭连接
    for (const [id, state] of this.activeConns.entries()) {
      if (!currentConnIds.has(id)) {
        if (now - state.lastSeen >= this.connectionGracePeriodMs) {
          this.activeConns.delete(id)
        }
      }
    }

    // 流量守恒与待归属余额对账：
    // 1. 当天归属量增加本次连接实际产生的 delta
    dayStats.attributedUpload += sumConnUpDelta
    dayStats.attributedDownload += sumConnDownDelta

    // 2. 权威全局总量累加全局 delta
    dayStats.rawGlobalUpload += globalUpDelta
    dayStats.rawGlobalDownload += globalDownDelta

    // 3. 闭环结算：
    //    Total = max(rawGlobal, attributed)
    //    Unknown = Total - attributed
    //    这样当连接增量滞后于全局时，先进入 Unknown；
    //    当下期连接增量爆发追上来时，优先从 Unknown 抵扣转移至 Node，彻底消除时差造成的双计！
    this.recalculateTotals(dayStats)

    // 同步更新 sessionStats 闭环对账
    this.sessionStats.attributedUpload += sumConnUpDelta
    this.sessionStats.attributedDownload += sumConnDownDelta
    this.sessionStats.rawGlobalUpload += globalUpDelta
    this.sessionStats.rawGlobalDownload += globalDownDelta
    this.recalculateTotals(this.sessionStats)

    this.lastGlobalUp = snapshot.uploadTotal
    this.lastGlobalDown = snapshot.downloadTotal
    this.data.checkpoint = {
      coreInstanceId: this.currentCoreInstanceId,
      lastCoreUploadTotal: snapshot.uploadTotal,
      lastCoreDownloadTotal: snapshot.downloadTotal,
      lastTimestamp: now,
      activeConnections: this.dumpActiveConnections()
    }
  }

  public getSummary(range: TrafficTimeRange = 'today', now: number = Date.now()): TrafficStatsSummary {
    const statsList: DayTrafficStats[] = []
    if (range === 'session') {
      statsList.push(this.sessionStats)
    } else {
      const targetDays = this.getTargetDays(range, now)
      for (const dayStr of targetDays) {
        const dayStats = this.data.days[dayStr]
        if (dayStats) {
          this.ensureDayStatsStructure(dayStats)
          statsList.push(dayStats)
        }
      }
    }

    let unknownUpload = 0
    let unknownDownload = 0

    const nodeMap = new Map<string, { upload: number; download: number }>()
    const groupMap = new Map<string, { upload: number; download: number }>()

    for (const dayStats of statsList) {
      unknownUpload += dayStats.unknownUpload
      unknownDownload += dayStats.unknownDownload

      for (const record of Object.values(dayStats.records)) {
        // Node 统计
        const existingNode = nodeMap.get(record.node)
        if (existingNode) {
          existingNode.upload += record.upload
          existingNode.download += record.download
        } else {
          nodeMap.set(record.node, { upload: record.upload, download: record.download })
        }

        // Group 统计
        const existingGroup = groupMap.get(record.group)
        if (existingGroup) {
          existingGroup.upload += record.upload
          existingGroup.download += record.download
        } else {
          groupMap.set(record.group, { upload: record.upload, download: record.download })
        }
      }
    }

    let sumNodeUpload = 0
    let sumNodeDownload = 0
    const nodes: TrafficSummaryItem[] = []
    for (const [name, stats] of nodeMap.entries()) {
      sumNodeUpload += stats.upload
      sumNodeDownload += stats.download
      nodes.push({
        name,
        upload: stats.upload,
        download: stats.download,
        total: stats.upload + stats.download
      })
    }

    const groups: TrafficSummaryItem[] = []
    for (const [name, stats] of groupMap.entries()) {
      groups.push({
        name,
        upload: stats.upload,
        download: stats.download,
        total: stats.upload + stats.download
      })
    }

    // 默认按 Total 降序排序
    nodes.sort((a, b) => b.total - a.total)
    groups.sort((a, b) => b.total - a.total)

    const totalUpload = sumNodeUpload + unknownUpload
    const totalDownload = sumNodeDownload + unknownDownload
    const total = totalUpload + totalDownload
    const unknownTotal = unknownUpload + unknownDownload

    return {
      range,
      totalUpload,
      totalDownload,
      total,
      unknownUpload,
      unknownDownload,
      unknownTotal,
      nodes,
      groups,
      updatedAt: now
    }
  }

  private getTargetDays(range: Exclude<TrafficTimeRange, 'session'>, now: number): string[] {
    const todayStr = formatLocalDate(now)
    if (range === 'today') {
      return [todayStr]
    }

    if (range === 'all') {
      return Object.keys(this.data.days)
    }

    const dayCount = range === '7d' ? 7 : 30
    const days: string[] = []
    const oneDayMs = 24 * 60 * 60 * 1000

    for (let i = 0; i < dayCount; i++) {
      const d = formatLocalDate(now - i * oneDayMs)
      days.push(d)
    }
    return days
  }

  public clear(now: number = Date.now()): void {
    this.data.days = {}
    this.sessionStats = {
      day: 'session',
      uploadTotal: 0,
      downloadTotal: 0,
      attributedUpload: 0,
      attributedDownload: 0,
      rawGlobalUpload: 0,
      rawGlobalDownload: 0,
      unknownUpload: 0,
      unknownDownload: 0,
      records: {}
    }
    this.data.checkpoint = {
      coreInstanceId: this.currentCoreInstanceId,
      lastCoreUploadTotal: this.lastGlobalUp ?? 0,
      lastCoreDownloadTotal: this.lastGlobalDown ?? 0,
      lastTimestamp: now,
      activeConnections: this.dumpActiveConnections()
    }
    this.dirty = true
  }
}
