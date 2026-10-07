export interface TrafficRecord {
  node: string
  group: string
  chains?: string[]
  upload: number
  download: number
}

export interface TrafficConnectionItem {
  id: string
  destination: string
  host: string
  port: string
  network: string
  process?: string
  processPath?: string
  node: string
  group: string
  chains?: string[]
  rule?: string
  upload: number
  download: number
  total: number
  start?: string
  lastSeen?: number
}

export interface DayTrafficStats {
  day: string // "YYYY-MM-DD"
  uploadTotal: number // 当天总上传 = max(rawGlobalUpload, attributedUpload)
  downloadTotal: number // 当天总下载 = max(rawGlobalDownload, attributedDownload)
  attributedUpload: number // 归属于节点/策略组的上传 bytes
  attributedDownload: number // 归属于节点/策略组的下载 bytes
  rawGlobalUpload: number // 权威全局上传累计 bytes
  rawGlobalDownload: number // 权威全局下载累计 bytes
  unknownUpload: number // 待归属余额 = uploadTotal - attributedUpload
  unknownDownload: number // 待归属余额 = downloadTotal - attributedDownload
  records: Record<string, TrafficRecord>
  connections?: Record<string, TrafficConnectionItem>
  processes?: Record<string, { upload: number; download: number }>
  hosts?: Record<string, { upload: number; download: number }>
}

export interface CheckpointConnection {
  upload: number
  download: number
  chains?: string[]
}

export interface TrafficCheckpoint {
  coreInstanceId?: string
  lastCoreUploadTotal: number
  lastCoreDownloadTotal: number
  lastTimestamp: number
  activeConnections?: Record<string, CheckpointConnection>
}

export interface TrafficStatsStorage {
  version: 1
  checkpoint: TrafficCheckpoint
  days: Record<string, DayTrafficStats>
  session?: DayTrafficStats // 当前内核运行的统计，与 checkpoint 的内核实例绑定
}

export interface TrafficSummaryItem {
  name: string
  upload: number
  download: number
  total: number
}

export type TrafficTimeRange = 'session' | 'today' | '7d' | '30d' | 'all'
export type TrafficDimension = 'nodes' | 'groups' | 'connections' | 'processes' | 'hosts'

export interface TrafficStatsSummary {
  range: TrafficTimeRange
  totalUpload: number
  totalDownload: number
  total: number
  unknownUpload: number
  unknownDownload: number
  unknownTotal: number
  nodes: TrafficSummaryItem[]
  groups: TrafficSummaryItem[]
  connections: TrafficConnectionItem[]
  processes: TrafficSummaryItem[]
  hosts: TrafficSummaryItem[]
  updatedAt: number
}

