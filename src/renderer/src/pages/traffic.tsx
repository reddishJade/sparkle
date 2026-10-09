import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, InputGroup, ListBox, Select, Tooltip } from '@heroui/react'
import { Virtuoso } from 'react-virtuoso'
import BasePage from '@renderer/components/base/base-page'
import ConfirmModal from '@renderer/components/base/base-confirm'
import { calcTrafficTotal as calcTraffic } from '@renderer/utils/calc'
import { clearTrafficStats, getTrafficStats } from '@renderer/utils/ipc'
import type {
  TrafficConnectionItem,
  TrafficDimension,
  TrafficStatsSummary,
  TrafficSummaryItem,
  TrafficTimeRange
} from '../../../shared/types/traffic'
import { LuCpu, LuGroup, LuServer } from 'react-icons/lu'
import { IoLayersOutline, IoLink, IoRefresh, IoStatsChart } from 'react-icons/io5'
import { AiOutlineGlobal } from 'react-icons/ai'
import { CgTrash } from 'react-icons/cg'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'

const STORAGE_KEY = 'sparkle_traffic_preferences'

interface TrafficPreferences {
  timeRange?: TrafficTimeRange
  dimension?: TrafficDimension
  sortBy?: 'total' | 'upload' | 'download'
  sortDirection?: 'asc' | 'desc'
}

function loadStoredPreferences(): TrafficPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as TrafficPreferences
  } catch {
    // ignore
  }
  return {}
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return ''
  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return timeStr
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function parseRuleDisplay(name: string): { type: string; payload?: string } {
  const match = name.match(/^([A-Za-z0-9_-]+)\((.*)\)$/)
  if (match) {
    return { type: match[1], payload: match[2] }
  }
  return { type: name }
}

function renderRankBadge(index: number) {
  if (index === 0) {
    return (
      <span className="w-5.5 h-5.5 rounded-md flex items-center justify-center font-mono text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
        1
      </span>
    )
  }
  if (index === 1) {
    return (
      <span className="w-5.5 h-5.5 rounded-md flex items-center justify-center font-mono text-xs font-bold bg-slate-400/15 text-slate-600 dark:text-slate-300 border border-slate-400/30 shrink-0">
        2
      </span>
    )
  }
  if (index === 2) {
    return (
      <span className="w-5.5 h-5.5 rounded-md flex items-center justify-center font-mono text-xs font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 shrink-0">
        3
      </span>
    )
  }
  return (
    <span className="w-5.5 h-5.5 flex items-center justify-center font-mono text-xs text-foreground-400/70 shrink-0">
      {index + 1}
    </span>
  )
}

type DisplayItem =
  | { kind: 'summary'; data: TrafficSummaryItem }
  | { kind: 'connection'; data: TrafficConnectionItem }

interface DimensionConfig {
  id: TrafficDimension
  label: string
  icon: React.ReactNode
}

const DIMENSIONS: DimensionConfig[] = [
  { id: 'nodes', label: '节点', icon: <LuServer className="text-sm" /> },
  { id: 'groups', label: '策略组', icon: <LuGroup className="text-sm" /> },
  { id: 'rules', label: '分流规则', icon: <IoLayersOutline className="text-sm" /> },
  { id: 'hosts', label: '目标域名', icon: <AiOutlineGlobal className="text-sm" /> },
  { id: 'processes', label: '应用进程', icon: <LuCpu className="text-sm" /> },
  { id: 'connections', label: '连接明细', icon: <IoLink className="text-sm" /> }
]

const dimensionLabels: Record<TrafficDimension, string> = {
  nodes: '节点',
  groups: '策略组',
  rules: '分流规则',
  hosts: '域名',
  processes: '进程',
  connections: '连接'
}

const timeRangeLabels: Record<TrafficTimeRange, string> = {
  session: '本次内核运行',
  today: '今日统计',
  '7d': '近 7 天累计',
  '30d': '近 30 天累计',
  all: '全部历史累计'
}

const TrafficPage: React.FC = () => {
  const initialPrefs = useMemo(() => loadStoredPreferences(), [])
  const [timeRange, setTimeRange] = useState<TrafficTimeRange>(initialPrefs.timeRange || 'session')
  const [dimension, setDimension] = useState<TrafficDimension>(initialPrefs.dimension || 'nodes')
  const [filter, setFilter] = useState('')
  const [sortBy, setSortBy] = useState<'total' | 'upload' | 'download'>(
    initialPrefs.sortBy || 'total'
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    initialPrefs.sortDirection || 'desc'
  )
  const [stats, setStats] = useState<TrafficStatsSummary | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // 选项偏好持久化
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ timeRange, dimension, sortBy, sortDirection })
      )
    } catch {
      // ignore
    }
  }, [timeRange, dimension, sortBy, sortDirection])

  const loadData = useCallback(async () => {
    try {
      const res = await getTrafficStats(timeRange)
      setStats(res)
    } catch {
      // ignore
    }
  }, [timeRange])

  useEffect(() => {
    void loadData()
    const timer = setInterval(() => {
      void loadData()
    }, 1000)
    return () => clearInterval(timer)
  }, [loadData])

  const handleManualRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true)
    try {
      await loadData()
    } finally {
      setTimeout(() => setIsRefreshing(false), 300)
    }
  }, [loadData])

  const handleClear = useCallback(async (): Promise<void> => {
    setShowClearConfirm(false)
    try {
      await clearTrafficStats()
      await loadData()
    } catch {
      // ignore
    }
  }, [loadData])

  const filteredAndSortedItems: DisplayItem[] = useMemo(() => {
    if (!stats) return []
    const dir = sortDirection === 'asc' ? 1 : -1
    const q = filter.trim().toLowerCase()

    if (dimension === 'connections') {
      let list = stats.connections || []
      if (q !== '') {
        list = list.filter(
          (item) =>
            item.destination.toLowerCase().includes(q) ||
            (item.process && item.process.toLowerCase().includes(q)) ||
            item.node.toLowerCase().includes(q) ||
            (item.rule && item.rule.toLowerCase().includes(q)) ||
            (item.rulePayload && item.rulePayload.toLowerCase().includes(q))
        )
      }
      const sorted = [...list].sort((a, b) => {
        if (sortBy === 'upload') return (a.upload - b.upload) * dir
        if (sortBy === 'download') return (a.download - b.download) * dir
        return (a.total - b.total) * dir
      })
      return sorted.map((item) => ({ kind: 'connection', data: item }))
    }

    let summaryList: TrafficSummaryItem[] = []
    if (dimension === 'nodes') summaryList = stats.nodes || []
    else if (dimension === 'groups') summaryList = stats.groups || []
    else if (dimension === 'rules') summaryList = stats.rules || []
    else if (dimension === 'processes') summaryList = stats.processes || []
    else if (dimension === 'hosts') summaryList = stats.hosts || []

    if (q !== '') {
      summaryList = summaryList.filter((item) => item.name.toLowerCase().includes(q))
    }
    const sorted = [...summaryList].sort((a, b) => {
      if (sortBy === 'upload') return (a.upload - b.upload) * dir
      if (sortBy === 'download') return (a.download - b.download) * dir
      return (a.total - b.total) * dir
    })
    return sorted.map((item) => ({ kind: 'summary', data: item }))
  }, [stats, dimension, filter, sortBy, sortDirection])

  const maxItemTotal = useMemo(() => {
    if (filteredAndSortedItems.length === 0) return 1
    let max = 0
    for (const item of filteredAndSortedItems) {
      if (item.data.total > max) max = item.data.total
    }
    return max > 0 ? max : 1
  }, [filteredAndSortedItems])

  const globalTotal = stats?.total ?? 0
  const globalUpload = stats?.totalUpload ?? 0
  const globalDownload = stats?.totalDownload ?? 0
  const globalUnknown = stats?.unknownTotal ?? 0
  const globalUpRatio = globalTotal > 0 ? (globalUpload / globalTotal) * 100 : 0
  const globalDownRatio = globalTotal > 0 ? (globalDownload / globalTotal) * 100 : 0

  return (
    <BasePage
      title="流量统计"
      contentClassName="overflow-hidden flex flex-col h-[calc(100vh-49px)]"
      header={
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 mr-1.5 px-2 py-0.5 rounded-full bg-default-100 dark:bg-default-50/30 text-xs text-foreground-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium">实时统计</span>
          </div>
          <Tooltip delay={0}>
            <Button
              size="sm"
              isIconOnly
              variant="ghost"
              data-color="default"
              aria-label="刷新"
              className="app-nodrag"
              onPress={handleManualRefresh}
            >
              <IoRefresh className={`text-lg ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Tooltip.Content placement="bottom">刷新数据</Tooltip.Content>
          </Tooltip>
          <Tooltip delay={0}>
            <Button
              size="sm"
              isIconOnly
              variant="ghost"
              data-color="danger"
              aria-label="清空统计"
              className="app-nodrag text-danger hover:bg-danger/10"
              onPress={() => setShowClearConfirm(true)}
            >
              <CgTrash className="text-lg" />
            </Button>
            <Tooltip.Content placement="bottom">清空统计数据</Tooltip.Content>
          </Tooltip>
        </div>
      }
    >
      {showClearConfirm && (
        <ConfirmModal
          title="清空流量统计记录"
          description={
            <div>
              <p className="text-sm text-foreground-600">
                确定要清空所有持久化流量统计数据吗？此操作无法撤销。
              </p>
              <p className="text-xs text-foreground-400 mt-2">
                清空后，所有节点、策略组、分流规则、连接、进程及域名的累计流量将被重置，统计将从当前时刻开始重新累计。
              </p>
            </div>
          }
          confirmText="确认清空"
          cancelText="取消"
          onChange={(open) => {
            if (!open) setShowClearConfirm(false)
          }}
          onConfirm={handleClear}
        />
      )}

      {/* 顶部全景概况指标卡片 */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* 卡片 1: 全景总流量 */}
          <div className="rounded-xl border border-border/40 bg-surface/80 p-2.5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-foreground-500 mb-1">
              <span className="font-medium">全景总流量</span>
              <IoStatsChart className="text-foreground-400 text-sm" />
            </div>
            <div className="text-lg font-bold font-mono text-foreground tracking-tight">
              {calcTraffic(globalTotal)}
            </div>
            <div className="w-full h-1 bg-default-100 dark:bg-default-50/20 rounded-full overflow-hidden flex mt-2">
              <div
                style={{ width: `${globalUpRatio}%` }}
                className="h-full bg-emerald-500"
                title={`上传占比 ${globalUpRatio.toFixed(1)}%`}
              />
              <div
                style={{ width: `${globalDownRatio}%` }}
                className="h-full bg-sky-500"
                title={`下载占比 ${globalDownRatio.toFixed(1)}%`}
              />
            </div>
          </div>

          {/* 卡片 2: 上行传输 */}
          <div className="rounded-xl border border-border/40 bg-surface/80 p-2.5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-foreground-500 mb-1">
              <span className="font-medium">上行传输</span>
              <span className="text-emerald-500 font-mono text-xs font-semibold">↑</span>
            </div>
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
              {calcTraffic(globalUpload)}
            </div>
            <div className="text-[11px] font-mono text-foreground-400 mt-1">
              占比 {globalUpRatio.toFixed(1)}%
            </div>
          </div>

          {/* 卡片 3: 下行传输 */}
          <div className="rounded-xl border border-border/40 bg-surface/80 p-2.5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-foreground-500 mb-1">
              <span className="font-medium">下行传输</span>
              <span className="text-sky-500 font-mono text-xs font-semibold">↓</span>
            </div>
            <div className="text-lg font-bold font-mono text-sky-600 dark:text-sky-400 tracking-tight">
              {calcTraffic(globalDownload)}
            </div>
            <div className="text-[11px] font-mono text-foreground-400 mt-1">
              占比 {globalDownRatio.toFixed(1)}%
            </div>
          </div>

          {/* 卡片 4: 统计维度与对账状态 */}
          <div className="rounded-xl border border-border/40 bg-surface/80 p-2.5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-xs text-foreground-500 mb-1">
              <span className="font-medium">{dimensionLabels[dimension]} 概况</span>
              {globalUnknown > 0 ? (
                <Tooltip delay={0}>
                  <span className="text-warning text-[10px] font-mono px-1.5 py-0.5 rounded bg-warning/10 cursor-help">
                    ? {calcTraffic(globalUnknown)}
                  </span>
                  <Tooltip.Content placement="bottom">
                    未归属流量：包含离线期间差额、快速关闭短连接或内核直连流量
                  </Tooltip.Content>
                </Tooltip>
              ) : (
                <span className="text-emerald-500 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10">
                  100% 归属
                </span>
              )}
            </div>
            <div className="text-lg font-bold font-mono text-foreground tracking-tight">
              {filteredAndSortedItems.length}
              <span className="text-xs font-normal text-foreground-400 ml-1">项</span>
            </div>
            <div className="text-[11px] text-foreground-400 mt-1 truncate">
              {timeRangeLabels[timeRange]}
            </div>
          </div>
        </div>
      </div>

      {/* 控制工具栏：维度分段选择器 + 搜索 + 范围 + 排序 */}
      <div className="px-3 py-2 flex flex-col gap-2 shrink-0 border-b border-border/30 bg-background/50 backdrop-blur-xs">
        {/* 第一行：平铺分段维度选择器 */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-xl bg-default-100/60 dark:bg-default-50/20 border border-border/30">
          {DIMENSIONS.map((dim) => {
            const active = dimension === dim.id
            return (
              <button
                key={dim.id}
                type="button"
                onClick={() => setDimension(dim.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer select-none ${
                  active
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-foreground-500 hover:text-foreground hover:bg-default-200/50'
                }`}
              >
                {dim.icon}
                <span>{dim.label}</span>
              </button>
            )
          })}
        </div>

        {/* 第二行：搜索过滤、时间跨度选择、排序字段与升降序 */}
        <div className="flex items-center gap-2">
          <InputGroup fullWidth className="relative h-8">
            <InputGroup.Input
              value={filter}
              placeholder={`搜索${dimensionLabels[dimension]}...`}
              onChange={(event) => setFilter(event.target.value)}
              className="text-xs"
            />
            {filter && (
              <InputGroup.Suffix>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label="清空"
                  onPress={() => setFilter('')}
                >
                  ×
                </Button>
              </InputGroup.Suffix>
            )}
          </InputGroup>

          <Select
            aria-label="时间跨度"
            className="w-28 shrink-0"
            data-size="sm"
            value={timeRange}
            onChange={(value) => {
              if (value) setTimeRange(value as TrafficTimeRange)
            }}
          >
            <Select.Trigger className="data-[hover=true]:bg-default-200">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover placement="bottom" shouldFlip containerPadding={56}>
              <ListBox>
                <ListBox.Item key="session" id="session" textValue="本次内核">
                  本次内核
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item key="today" id="today" textValue="今日">
                  今日
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item key="7d" id="7d" textValue="近 7 天">
                  近 7 天
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item key="30d" id="30d" textValue="近 30 天">
                  近 30 天
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item key="all" id="all" textValue="全部历史">
                  全部历史
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            aria-label="排序字段"
            className="w-28 shrink-0"
            data-size="sm"
            value={sortBy}
            onChange={(value) => {
              if (value) setSortBy(value as 'total' | 'upload' | 'download')
            }}
          >
            <Select.Trigger className="data-[hover=true]:bg-default-200">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover placement="bottom" shouldFlip containerPadding={56}>
              <ListBox>
                <ListBox.Item key="total" id="total" textValue="总流量">
                  总流量
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item key="upload" id="upload" textValue="上传量">
                  上传量
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item key="download" id="download" textValue="下载量">
                  下载量
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>

          <Button
            size="sm"
            isIconOnly
            aria-label={sortDirection === 'asc' ? '升序' : '降序'}
            onPress={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
            variant="primary"
            data-color="default"
            className="bg-content2 shrink-0"
          >
            {sortDirection === 'asc' ? (
              <HiSortAscending className="text-lg" />
            ) : (
              <HiSortDescending className="text-lg" />
            )}
          </Button>
        </div>
      </div>

      {/* 统计明细列表 (虚拟滚动) */}
      <div className="flex-1 min-h-0">
        {filteredAndSortedItems.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-foreground-400">
            <IoStatsChart className="text-3xl text-foreground-300" />
            <p className="text-sm font-medium">
              {filter ? '没有匹配的流量统计项' : '所选时间跨度暂无流量记录'}
            </p>
            {filter && (
              <Button size="sm" variant="ghost" onPress={() => setFilter('')}>
                清除搜索条件
              </Button>
            )}
          </div>
        ) : (
          <Virtuoso
            className="h-full"
            data={filteredAndSortedItems}
            itemContent={(index, item) => {
              const isConnection = item.kind === 'connection'
              const data = item.data
              const total = data.total
              const upload = data.upload
              const download = data.download
              const relPercent = Math.max(1, Math.min(100, (total / maxItemTotal) * 100))
              const upPercent = total > 0 ? (upload / total) * 100 : 0
              const downPercent = total > 0 ? (download / total) * 100 : 0
              const globalShare =
                stats && stats.total > 0 ? ((total / stats.total) * 100).toFixed(1) : '0.0'

              if (isConnection) {
                const conn = item.data as TrafficConnectionItem
                const isUdp = conn.network?.toLowerCase() === 'udp'
                return (
                  <div
                    key={conn.id}
                    className={`px-3 pb-1.5 ${index === 0 ? 'pt-2' : ''}`}
                    style={{ minHeight: 74 }}
                  >
                    <div className="rounded-xl border border-border/40 bg-surface/80 hover:bg-default-100/40 hover:border-border/80 transition-colors p-2.5 shadow-2xs">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {renderRankBadge(index)}
                          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`text-[10px] px-1 py-0.5 rounded font-mono font-medium uppercase leading-none shrink-0 ${
                                  isUdp
                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                    : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                }`}
                              >
                                {conn.network || 'TCP'}
                              </span>
                              <span className="truncate text-sm font-medium select-text">
                                {conn.destination}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-foreground-400 truncate">
                              {conn.process && (
                                <>
                                  <span className="truncate max-w-[130px] text-foreground-500 font-medium">
                                    {conn.process}
                                  </span>
                                  <span>•</span>
                                </>
                              )}
                              <span className="truncate max-w-[140px] flag-emoji">
                                {conn.node}
                              </span>
                              {conn.rule && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[120px]">
                                    {conn.rule}
                                    {conn.rulePayload ? `(${conn.rulePayload})` : ''}
                                  </span>
                                </>
                              )}
                              {conn.start && (
                                <>
                                  <span>•</span>
                                  <span className="shrink-0 font-mono text-[11px]">
                                    {formatTime(conn.start)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 流量数据列 */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex flex-col items-end font-mono text-[11px] leading-tight">
                            <span className="text-emerald-600 dark:text-emerald-400">
                              ↑ {calcTraffic(conn.upload)}
                            </span>
                            <span className="text-sky-600 dark:text-sky-400">
                              ↓ {calcTraffic(conn.download)}
                            </span>
                          </div>
                          <div className="px-2 py-1 rounded-md bg-default-100 dark:bg-default-50/40 text-foreground font-mono text-xs font-semibold">
                            {calcTraffic(conn.total)}
                          </div>
                          <div className="w-11 text-right font-mono text-[11px] text-foreground-400">
                            {globalShare}%
                          </div>
                        </div>
                      </div>

                      {/* 流量占比可视化指示条 */}
                      <div className="w-full h-1 bg-default-100 dark:bg-default-50/20 rounded-full overflow-hidden mt-2">
                        <div
                          style={{ width: `${relPercent}%` }}
                          className="h-full flex overflow-hidden rounded-full"
                        >
                          <div
                            style={{ width: `${upPercent}%` }}
                            className="h-full bg-emerald-500/80"
                          />
                          <div
                            style={{ width: `${downPercent}%` }}
                            className="h-full bg-sky-500/80"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }

              // 汇总维度：节点、策略组、分流规则、域名、进程
              const summary = item.data as TrafficSummaryItem
              return (
                <div
                  key={summary.name}
                  className={`px-3 pb-1.5 ${index === 0 ? 'pt-2' : ''}`}
                  style={{ minHeight: 64 }}
                >
                  <div className="rounded-xl border border-border/40 bg-surface/80 hover:bg-default-100/40 hover:border-border/80 transition-colors p-2.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {renderRankBadge(index)}

                        {dimension === 'rules' ? (
                          (() => {
                            const { type, payload } = parseRuleDisplay(summary.name)
                            return (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-default-100 dark:bg-default-50/60 text-foreground-500 uppercase shrink-0">
                                  {type}
                                </span>
                                {payload ? (
                                  <span className="truncate text-sm font-medium text-foreground select-text font-mono text-[13px]">
                                    {payload}
                                  </span>
                                ) : null}
                              </div>
                            )
                          })()
                        ) : dimension === 'hosts' ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AiOutlineGlobal className="text-foreground-400 shrink-0 text-sm" />
                            <span className="truncate text-sm font-medium text-foreground select-text font-mono text-[13px]">
                              {summary.name}
                            </span>
                          </div>
                        ) : dimension === 'processes' ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <LuCpu className="text-foreground-400 shrink-0 text-sm" />
                            <span className="truncate text-sm font-medium text-foreground select-text">
                              {summary.name}
                            </span>
                          </div>
                        ) : dimension === 'groups' ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <LuGroup className="text-foreground-400 shrink-0 text-sm" />
                            <span className="truncate text-sm font-medium text-foreground">
                              {summary.name}
                            </span>
                          </div>
                        ) : (
                          // nodes
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate text-sm font-medium text-foreground flag-emoji">
                              {summary.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 流量数据列 */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex flex-col items-end font-mono text-[11px] leading-tight">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ↑ {calcTraffic(summary.upload)}
                          </span>
                          <span className="text-sky-600 dark:text-sky-400">
                            ↓ {calcTraffic(summary.download)}
                          </span>
                        </div>
                        <div className="px-2 py-1 rounded-md bg-default-100 dark:bg-default-50/40 text-foreground font-mono text-xs font-semibold">
                          {calcTraffic(summary.total)}
                        </div>
                        <div className="w-11 text-right font-mono text-[11px] text-foreground-400">
                          {globalShare}%
                        </div>
                      </div>
                    </div>

                    {/* 流量占比可视化指示条 */}
                    <div className="w-full h-1 bg-default-100 dark:bg-default-50/20 rounded-full overflow-hidden mt-2">
                      <div
                        style={{ width: `${relPercent}%` }}
                        className="h-full flex overflow-hidden rounded-full"
                      >
                        <div
                          style={{ width: `${upPercent}%` }}
                          className="h-full bg-emerald-500/80"
                        />
                        <div
                          style={{ width: `${downPercent}%` }}
                          className="h-full bg-sky-500/80"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            }}
          />
        )}
      </div>
    </BasePage>
  )
}

export default TrafficPage
