import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip, InputGroup, ListBox, Select, Separator, Tooltip } from '@heroui/react'
import { Virtuoso } from 'react-virtuoso'
import BasePage from '@renderer/components/base/base-page'
import ConfirmModal from '@renderer/components/base/base-confirm'
import { calcTraffic } from '@renderer/utils/calc'
import { clearTrafficStats, getTrafficStats } from '@renderer/utils/ipc'
import type {
  TrafficConnectionItem,
  TrafficDimension,
  TrafficStatsSummary,
  TrafficSummaryItem,
  TrafficTimeRange
} from '../../../shared/types/traffic'
import { CgTrash } from 'react-icons/cg'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'
import { IoRefresh } from 'react-icons/io5'

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

type DisplayItem =
  | { kind: 'summary'; data: TrafficSummaryItem }
  | { kind: 'connection'; data: TrafficConnectionItem }

const TrafficPage: React.FC = () => {
  const initialPrefs = useMemo(() => loadStoredPreferences(), [])
  const [timeRange, setTimeRange] = useState<TrafficTimeRange>(initialPrefs.timeRange || 'today')
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

  // 选项持久化记忆：切换页面或重启后保留上一次的视图偏好
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
            (item.rule && item.rule.toLowerCase().includes(q))
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

  return (
    <BasePage
      title="流量统计"
      contentClassName="overflow-y-hidden"
      header={
        <div className="flex items-center gap-2">
          {stats && (
            <div className="flex items-center gap-2 text-xs font-mono text-foreground-500 mr-1">
              <span>↑ {calcTraffic(stats.totalUpload)}</span>
              <span>↓ {calcTraffic(stats.totalDownload)}</span>
              <Chip size="sm" variant="soft" data-color="primary" className="font-mono text-xs">
                <Chip.Label>{calcTraffic(stats.total)}</Chip.Label>
              </Chip>
              {stats.unknownTotal > 0 && (
                <Tooltip delay={0}>
                  <Chip
                    size="sm"
                    variant="soft"
                    data-color="warning"
                    className="cursor-help font-mono text-xs"
                  >
                    <Chip.Label>? {calcTraffic(stats.unknownTotal)}</Chip.Label>
                  </Chip>
                  <Tooltip.Content placement="bottom">
                    未归属流量：包含离线期间差额、快速关闭短连接或内核内部直连流量
                  </Tooltip.Content>
                </Tooltip>
              )}
            </div>
          )}
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
                清空后，所有节点、策略组、连接、进程及域名的累计流量将被重置，统计将从当前时刻开始重新累计。
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

      <div className="flex h-full min-h-0 flex-col">
        {/* 控制工具栏：与 Connections 页面 100% 结构和尺寸对齐 */}
        <div className="overflow-x-auto sticky top-0 z-40">
          <div className="flex p-2 gap-2">
            {/* 单元 1：节点与策略组 */}
            <Select
              aria-label="代理链路维度"
              placeholder="节点 / 策略组"
              className="w-36 shrink-0"
              data-size="sm"
              value={dimension === 'nodes' || dimension === 'groups' ? dimension : null}
              onChange={(value) => {
                if (value) setDimension(value as TrafficDimension)
              }}
            >
              <Select.Trigger className="data-[hover=true]:bg-default-200">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom" shouldFlip containerPadding={56}>
                <ListBox>
                  <ListBox.Item key="nodes" id="nodes" textValue="节点">
                    节点
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item key="groups" id="groups" textValue="策略组">
                    策略组
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>

            {/* 单元 2：连接、域名与进程 */}
            <Select
              aria-label="网络流量维度"
              placeholder="连接 / 域名 / 进程"
              className="w-40 shrink-0"
              data-size="sm"
              value={
                dimension === 'connections' || dimension === 'hosts' || dimension === 'processes'
                  ? dimension
                  : null
              }
              onChange={(value) => {
                if (value) setDimension(value as TrafficDimension)
              }}
            >
              <Select.Trigger className="data-[hover=true]:bg-default-200">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom" shouldFlip containerPadding={56}>
                <ListBox>
                  <ListBox.Item key="connections" id="connections" textValue="连接">
                    连接
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item key="hosts" id="hosts" textValue="域名">
                    域名
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item key="processes" id="processes" textValue="进程">
                    进程
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>

            <InputGroup fullWidth className="relative h-8 px-3">
              <InputGroup.Input
                value={filter}
                placeholder="筛选过滤"
                onChange={(event) => setFilter(event.target.value)}
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
                  <ListBox.Item key="session" id="session" textValue="本次运行">
                    本次运行
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
              className="bg-content2"
            >
              {sortDirection === 'asc' ? (
                <HiSortAscending className="text-lg" />
              ) : (
                <HiSortDescending className="text-lg" />
              )}
            </Button>
          </div>
          <Separator />
        </div>

        {/* 统计列表：卡片与 Virtuoso 规范完全对齐 Connections */}
        <div className="h-[calc(100vh-100px)] mt-px">
          {filteredAndSortedItems.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-foreground-400">
              {filter ? '没有匹配的统计项' : '所选时间范围内暂无流量记录'}
            </div>
          ) : (
            <Virtuoso
              className="h-full"
              data={filteredAndSortedItems}
              itemContent={(index, item) => {
                if (item.kind === 'connection') {
                  const conn = item.data
                  return (
                    <div
                      key={conn.id}
                      className={`px-2 pb-1 ${index === 0 ? 'pt-1' : ''}`}
                      style={{ minHeight: 64 }}
                    >
                      <Card className="w-full">
                        <Card.Content className="py-2 px-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <small className="w-6 shrink-0 text-right font-mono text-foreground-400">
                                {index + 1}
                              </small>
                              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-[10px] px-1 py-0.5 rounded bg-default-100 font-mono text-foreground-500 uppercase leading-none shrink-0">
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
                                  <span className="truncate max-w-[150px] flag-emoji">
                                    {conn.node}
                                  </span>
                                  {conn.rule && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate max-w-[110px]">{conn.rule}</span>
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
                            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
                              <Chip
                                size="sm"
                                data-color="default"
                                variant="tertiary"
                                data-outline="true"
                                data-radius="sm"
                                className="font-mono text-xs"
                              >
                                <Chip.Label>
                                  ↑ {calcTraffic(conn.upload)} ↓ {calcTraffic(conn.download)}
                                </Chip.Label>
                              </Chip>
                              <Chip
                                size="sm"
                                data-color="primary"
                                variant="soft"
                                data-radius="sm"
                                className="font-mono text-xs font-semibold"
                              >
                                <Chip.Label>{calcTraffic(conn.total)}</Chip.Label>
                              </Chip>
                            </div>
                          </div>
                        </Card.Content>
                      </Card>
                    </div>
                  )
                }

                const summary = item.data
                return (
                  <div
                    key={summary.name}
                    className={`px-2 pb-1 ${index === 0 ? 'pt-1' : ''}`}
                    style={{ minHeight: 60 }}
                  >
                    <Card className="w-full">
                      <Card.Content className="py-2.5 px-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <small className="w-6 shrink-0 text-right font-mono text-foreground-400">
                              {index + 1}
                            </small>
                            <div className="truncate text-left text-sm font-medium">
                              <span className="flag-emoji">{summary.name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
                            <Chip
                              size="sm"
                              data-color="default"
                              variant="tertiary"
                              data-outline="true"
                              data-radius="sm"
                              className="font-mono text-xs"
                            >
                              <Chip.Label>
                                ↑ {calcTraffic(summary.upload)} ↓ {calcTraffic(summary.download)}
                              </Chip.Label>
                            </Chip>
                            <Chip
                              size="sm"
                              data-color="primary"
                              variant="soft"
                              data-radius="sm"
                              className="font-mono text-xs font-semibold"
                            >
                              <Chip.Label>{calcTraffic(summary.total)}</Chip.Label>
                            </Chip>
                          </div>
                        </div>
                      </Card.Content>
                    </Card>
                  </div>
                )
              }}
            />
          )}
        </div>
      </div>
    </BasePage>
  )
}

export default TrafficPage
