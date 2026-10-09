import fs from 'fs'
import { UsageJournal } from './usage-journal'
import type { UsageQuery, UsageResult } from '../../shared/types/traffic'
import { trafficStatsPath } from '../utils/dirs'
import { TrafficStatsEngine } from './traffic-stats-engine'
import type {
  TrafficStatsStorage,
  TrafficStatsSummary,
  TrafficTimeRange
} from '../../shared/types/traffic'
import { appendAppLog } from '../utils/log'

const FLUSH_INTERVAL_MS = 10000

class TrafficStatsService {
  private usage: UsageJournal
  private engine: TrafficStatsEngine
  private flushTimer: NodeJS.Timeout | null = null
  private filePath: string
  private tmpFilePath: string
  private backupFilePath: string
  private isSaving = false
  private usageRevision = 0
  private savedUsageRevision = 0

  constructor() {
    this.filePath = trafficStatsPath()
    this.tmpFilePath = `${this.filePath}.tmp`
    this.backupFilePath = `${this.filePath}.backup`
    const saved = this.loadData()
    this.engine = new TrafficStatsEngine(saved)
    this.usage = new UsageJournal(saved?.usage)
    this.startFlushTimer()
  }

  private loadData(): Partial<TrafficStatsStorage> | undefined {
    // 1. 优先尝试从主文件读取
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        return JSON.parse(raw) as TrafficStatsStorage
      }
    } catch (error) {
      appendAppLog(
        `[TrafficStats]: Failed to load traffic stats from primary file: ${error}\n`
      ).catch(() => {})
    }

    // 2. 主文件损坏或读取失败时，尝试从备份文件 (.backup) 恢复
    try {
      if (fs.existsSync(this.backupFilePath)) {
        const raw = fs.readFileSync(this.backupFilePath, 'utf-8')
        const data = JSON.parse(raw) as TrafficStatsStorage
        appendAppLog(
          `[TrafficStats]: Successfully restored traffic stats from backup file\n`
        ).catch(() => {})
        return data
      }
    } catch (backupError) {
      appendAppLog(
        `[TrafficStats]: Failed to load traffic stats from backup file: ${backupError}\n`
      ).catch(() => {})
    }

    return undefined
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => {
      if (
        (this.engine.isDirty() || this.usageRevision !== this.savedUsageRevision) &&
        !this.isSaving
      ) {
        void this.flush()
      }
    }, FLUSH_INTERVAL_MS)
  }

  private currentCoreInstanceId: string | undefined = undefined

  public setCoreInstanceId(id?: string): void {
    this.currentCoreInstanceId = id
  }

  public feedSnapshot(snapshot: ControllerConnections): void {
    try {
      const now = Date.now()
      this.usage.feed(snapshot, now, this.currentCoreInstanceId)
      this.usageRevision++
      this.engine.feedSnapshot(snapshot, now, this.currentCoreInstanceId)
    } catch (error) {
      appendAppLog(`[TrafficStats]: Error processing snapshot: ${error}\n`).catch(() => {})
    }
  }

  public getUsage(query: UsageQuery): UsageResult {
    return this.usage.query(query)
  }

  public async setUsageRetention(value: number): Promise<void> {
    this.usage.setRetention(value)
    this.usageRevision++
    await this.flush()
  }

  public getSummary(range: TrafficTimeRange = 'today'): TrafficStatsSummary {
    return this.engine.getSummary(range)
  }

  public async clear(): Promise<void> {
    this.engine.clear()
    this.usage.clear()
    this.usageRevision++
    await this.flush()
  }

  public async flush(): Promise<void> {
    if (this.isSaving) return
    this.isSaving = true
    const revision = this.usageRevision
    try {
      const data = { ...this.engine.getRawData(), usage: this.usage.serialize() }
      const content = JSON.stringify(data, null, 2)
      await fs.promises.writeFile(this.tmpFilePath, content, 'utf-8')

      // 在更新主文件前，制作主文件备份
      try {
        if (fs.existsSync(this.filePath)) {
          await fs.promises.copyFile(this.filePath, this.backupFilePath)
        }
      } catch {
        // 备份失败不阻断主写入
      }

      try {
        await fs.promises.rename(this.tmpFilePath, this.filePath)
      } catch {
        // 在某些平台（如 Windows）可能出现目标文件冲突，尝试 unlink 后重命名
        try {
          await fs.promises.unlink(this.filePath).catch(() => {})
          await fs.promises.rename(this.tmpFilePath, this.filePath)
        } catch {
          // 兜底直接覆盖写入
          await fs.promises.writeFile(this.filePath, content, 'utf-8')
          await fs.promises.unlink(this.tmpFilePath).catch(() => {})
        }
      }
      this.engine.markClean()
      this.savedUsageRevision = revision
    } catch (error) {
      await appendAppLog(`[TrafficStats]: Failed to save traffic stats: ${error}\n`).catch(() => {})
    } finally {
      this.isSaving = false
    }
  }

  public flushSync(): void {
    try {
      if (!this.engine.isDirty() && this.usageRevision === this.savedUsageRevision) return
      const data = { ...this.engine.getRawData(), usage: this.usage.serialize() }
      const content = JSON.stringify(data, null, 2)
      fs.writeFileSync(this.tmpFilePath, content, 'utf-8')

      try {
        if (fs.existsSync(this.filePath)) {
          fs.copyFileSync(this.filePath, this.backupFilePath)
        }
      } catch {
        // ignore
      }

      try {
        fs.renameSync(this.tmpFilePath, this.filePath)
      } catch {
        try {
          if (fs.existsSync(this.filePath)) {
            fs.unlinkSync(this.filePath)
          }
          fs.renameSync(this.tmpFilePath, this.filePath)
        } catch {
          fs.writeFileSync(this.filePath, content, 'utf-8')
          if (fs.existsSync(this.tmpFilePath)) {
            fs.unlinkSync(this.tmpFilePath)
          }
        }
      }
      this.engine.markClean()
      this.savedUsageRevision = this.usageRevision
    } catch {
      // ignore in sync exit
    }
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    this.flushSync()
  }
}

export const trafficStatsService = new TrafficStatsService()
