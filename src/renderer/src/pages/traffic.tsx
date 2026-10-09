// Adapted from metacubexd's traffic page and useDataUsage; see licenses/metacubexd-MIT.txt.
import { Button, InputGroup } from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import BasePage from '@renderer/components/base/base-page'
import ConfirmModal from '@renderer/components/base/base-confirm'
import HistoryChart from '@renderer/components/home/history-chart'
import { calcTraffic } from '@renderer/utils/calc'
import { clearTrafficStats, getUsage, setUsageRetention } from '@renderer/utils/ipc'
import { notify } from '@renderer/utils/notification'
import type { UsageDimension, UsageEntry, UsageQuery } from '../../../shared/types/traffic'
import { downloadText, csvField } from '@renderer/utils/download'

const views: Array<[UsageDimension, string]> = [
  ['sourceIP', '设备'],
  ['inboundUser', '用户'],
  ['host', '域名'],
  ['outbound', '节点'],
  ['process', '进程']
]
const ranges = [
  [3600000, '最近一小时'],
  [86400000, '最近一天'],
  [604800000, '最近一周'],
  [2592000000, '最近一月'],
  [-1, '自定义']
] as const
const dateInput = (time: number) => {
  const date = new Date(time)
  return new Date(time - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function preference<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}
export default function UsagePage() {
  const [dimension, setDimension] = useState<UsageDimension>(() =>
    preference('usage-view', 'sourceIP')
  )
  const [range, setRange] = useState<number>(() => preference('usage-range', 3600000))
  const [start, setStart] = useState(() =>
    preference('usage-start', dateInput(Date.now() - 86400000))
  )
  const [end, setEnd] = useState(() => preference('usage-end', dateInput(Date.now())))
  const [now, setNow] = useState(Date.now())
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<'label' | 'upload' | 'download' | 'total' | 'count'>('total')
  const [descending, setDescending] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [subselected, setSubselected] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [pendingRetention, setPendingRetention] = useState<number | null>(null)
  const query = useMemo<UsageQuery>(
    () => ({
      start: range === -1 ? new Date(start).getTime() : now - range,
      end: range === -1 ? new Date(end).getTime() : now,
      dimension
    }),
    [dimension, range, start, end, now]
  )
  const valid =
    Number.isFinite(query.start) && Number.isFinite(query.end) && query.start < query.end
  const { data, error, mutate, isLoading } = useSWR(
    valid ? ['usage', query] : null,
    () => getUsage(query),
    { keepPreviousData: true }
  )
  const subDimension: UsageDimension = dimension === 'host' ? 'sourceIP' : 'host'
  const filters = useMemo(
    () => (selected === null ? undefined : { [dimension]: selected }),
    [dimension, selected]
  )
  const { data: sub, mutate: mutateSub } = useSWR(
    valid && filters ? ['usage-sub', query, filters] : null,
    () => getUsage({ ...query, dimension: subDimension, filters })
  )
  const detailDimension: UsageDimension = dimension === 'outbound' ? 'sourceIP' : 'outbound'
  const { data: detail, mutate: mutateDetail } = useSWR(
    valid && selected !== null && subselected !== null
      ? ['usage-detail', query, filters, subselected]
      : null,
    () =>
      getUsage({
        ...query,
        dimension: detailDimension,
        filters: { ...filters, [subDimension]: subselected! }
      })
  )
  useEffect(() => {
    const timer = setInterval(() => {
      if (range !== -1) setNow(Date.now())
      else {
        void mutate()
        void mutateSub()
        void mutateDetail()
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [range, mutate, mutateSub, mutateDetail])
  useEffect(() => {
    for (const [key, value] of [
      ['usage-view', dimension],
      ['usage-range', range],
      ['usage-start', start],
      ['usage-end', end]
    ])
      localStorage.setItem(key as string, JSON.stringify(value))
  }, [dimension, range, start, end])
  useEffect(() => {
    setSelected(null)
    setSubselected(null)
  }, [dimension, range, start, end])
  const rows = useMemo(
    () =>
      (data?.entries ?? [])
        .filter((entry) => entry.label.toLowerCase().includes(filter.toLowerCase()))
        .sort(
          (a, b) =>
            (sort === 'label' ? a.label.localeCompare(b.label) : a[sort] - b[sort]) *
            (descending ? -1 : 1)
        ),
    [data, filter, sort, descending]
  )
  const label = views.find(([id]) => id === dimension)?.[1] ?? '设备'
  async function refresh(): Promise<void> {
    setNow(Date.now())
    await Promise.all([mutate(), mutateSub(), mutateDetail()])
  }
  async function changeRetention(value: number): Promise<void> {
    try {
      await setUsageRetention(value)
      await refresh()
    } catch (e) {
      notify(e, { variant: 'danger' })
    }
  }
  return (
    <BasePage
      title="用量"
      header={
        <div className="flex gap-1 app-nodrag">
          <Button size="sm" variant="ghost" onPress={() => void refresh()}>
            刷新
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() =>
              downloadText(
                'sparkle-usage.csv',
                'text/csv',
                [
                  '名称,上传,下载,总量,连接数',
                  ...rows.map((r) =>
                    [csvField(r.label), r.upload, r.download, r.total, r.count].join(',')
                  )
                ].join('\n')
              )
            }
          >
            导出
          </Button>
          <Button size="sm" variant="ghost" onPress={() => setClearOpen(true)}>
            清空
          </Button>
        </div>
      }
    >
      <div className="dashboard-content">
        <div className="flex flex-wrap gap-2 items-center">
          {views.map(([id, name]) => (
            <Button
              key={id}
              size="sm"
              variant={dimension === id ? 'primary' : 'ghost'}
              onPress={() => setDimension(id)}
            >
              {name}
            </Button>
          ))}
          <div className="flex-1" />
          <select
            className="dashboard-select"
            aria-label="时间范围"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            {ranges.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="dashboard-select"
            aria-label="数据保留时长"
            value={data?.retention ?? 2592000000}
            onChange={(e) => {
              const value = Number(e.target.value)
              if (value > 0 && (data?.retention === -1 || value < (data?.retention ?? Infinity)))
                setPendingRetention(value)
              else void changeRetention(value)
            }}
          >
            <option value={-1}>永久保留</option>
            {ranges
              .filter(([id]) => id !== -1)
              .map(([id, name]) => (
                <option key={id} value={id}>
                  保留{name.replace('最近', '')}
                </option>
              ))}
          </select>
        </div>
        {range === -1 && (
          <div className="flex flex-wrap gap-2">
            <label>
              从{' '}
              <input
                className="dashboard-select"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              至{' '}
              <input
                className="dashboard-select"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
        )}
        {!valid && (
          <p role="alert" className="text-danger text-sm">
            请选择有效的起止时间，结束时间须晚于开始时间。
          </p>
        )}
        {error && (
          <p role="alert" className="text-danger text-sm">
            读取用量失败：{String(error)}{' '}
            <Button size="sm" onPress={() => void refresh()}>
              重试
            </Button>
          </p>
        )}
        <div className="dashboard-metrics">
          {[
            ['总用量', calcTraffic((data?.totalUpload ?? 0) + (data?.totalDownload ?? 0))],
            ['上传', calcTraffic(data?.totalUpload ?? 0)],
            ['下载', calcTraffic(data?.totalDownload ?? 0)],
            ['连接', data?.count ?? 0],
            ['统计项目', data?.entries.length ?? 0]
          ].map(([name, value]) => (
            <div key={name} className="dashboard-panel">
              <div className="text-xs text-foreground-500 mb-2">{name}</div>
              <div className="text-lg font-semibold tabular-nums">{value}</div>
            </div>
          ))}
        </div>
        <section className="dashboard-panel">
          <h2>流量趋势</h2>
          <HistoryChart
            timestamps={data?.trend.map((point) => point.time)}
            series={[
              data?.trend.map((p) => p.download) ?? [],
              data?.trend.map((p) => p.upload) ?? []
            ]}
            labels={['下载', '上传']}
            format={calcTraffic}
          />
          <p className="text-xs text-foreground-500">
            {valid
              ? `${new Date(query.start).toLocaleString()} — ${new Date(query.end).toLocaleString()}`
              : '—'}{' '}
            · 按分钟记录连接流量；历史数据从{' '}
            {data?.startedAt ? new Date(data.startedAt).toLocaleString() : '首次运行'} 开始采集。
          </p>
        </section>
        <div className="usage-layout">
          <section className="dashboard-panel">
            <div className="flex justify-between items-center gap-2">
              <h2>{label}用量</h2>
              <InputGroup className="max-w-52">
                <InputGroup.Input
                  aria-label="筛选用量"
                  placeholder="搜索…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </InputGroup>
            </div>
            <UsageTable
              entries={rows}
              selected={selected}
              onSelect={(value) => {
                setSelected(value)
                setSubselected(null)
              }}
              sort={sort}
              descending={descending}
              onSort={(next) => {
                if (next === sort) setDescending(!descending)
                else {
                  setSort(next)
                  setDescending(true)
                }
              }}
            />
            {!rows.length && (
              <p className="dashboard-empty">{isLoading ? '正在读取…' : '此时间范围内暂无记录'}</p>
            )}
          </section>
          <section className="dashboard-panel">
            <h2>
              {selected ?? '详情'}
              {selected !== null ? ` · ${subDimension === 'host' ? '域名' : '设备'}` : ''}
            </h2>
            {selected === null ? (
              <p className="dashboard-empty">选择左侧项目，查看域名、设备和节点明细。</p>
            ) : (
              <>
                <UsageTable
                  entries={sub?.entries ?? []}
                  selected={subselected}
                  onSelect={setSubselected}
                />
                {subselected !== null && (
                  <div className="mt-4">
                    <h2>
                      {subselected} · {detailDimension === 'sourceIP' ? '设备' : '节点'}
                    </h2>
                    <UsageTable entries={detail?.entries ?? []} />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
        <div className="dashboard-grid">
          <section className="dashboard-panel">
            <h2>上传排行</h2>
            {[...(data?.entries ?? [])]
              .sort((a, b) => b.upload - a.upload)
              .slice(0, 5)
              .map((entry) => (
                <button
                  className="dashboard-rank"
                  key={entry.label}
                  onClick={() => setSelected(entry.label)}
                >
                  <span className="truncate">{entry.label}</span>
                  <span>{calcTraffic(entry.upload)}</span>
                </button>
              ))}
          </section>
          <section className="dashboard-panel">
            <h2>下载排行</h2>
            {[...(data?.entries ?? [])]
              .sort((a, b) => b.download - a.download)
              .slice(0, 5)
              .map((entry) => (
                <button
                  className="dashboard-rank"
                  key={entry.label}
                  onClick={() => setSelected(entry.label)}
                >
                  <span className="truncate">{entry.label}</span>
                  <span>{calcTraffic(entry.download)}</span>
                </button>
              ))}
          </section>
        </div>
      </div>
      {clearOpen && (
        <ConfirmModal
          title="清空用量记录"
          description="将清空全部用量和原有流量统计记录，随后重新累计。"
          onChange={(open) => {
            if (!open) setClearOpen(false)
          }}
          onConfirm={async () => {
            try {
              await clearTrafficStats()
              setSelected(null)
              setSubselected(null)
              await refresh()
              setClearOpen(false)
            } catch (e) {
              notify(e, { variant: 'danger' })
            }
          }}
        />
      )}
      {pendingRetention !== null && (
        <ConfirmModal
          title="缩短数据保留时长"
          description="超出保留时长的用量记录会被永久删除。"
          onChange={(open) => {
            if (!open) setPendingRetention(null)
          }}
          onConfirm={async () => {
            await changeRetention(pendingRetention)
            setPendingRetention(null)
          }}
        />
      )}
    </BasePage>
  )
}
type Sort = 'label' | 'upload' | 'download' | 'total' | 'count'
function UsageTable({
  entries,
  selected,
  onSelect,
  sort,
  descending,
  onSort
}: {
  entries: UsageEntry[]
  selected?: string | null
  onSelect?: (label: string) => void
  sort?: Sort
  descending?: boolean
  onSort?: (field: Sort) => void
}) {
  const columns: Array<[Sort, string]> = [
    ['label', '名称'],
    ['upload', '上传'],
    ['download', '下载'],
    ['total', '总量'],
    ['count', '连接']
  ]
  return (
    <div className="overflow-auto max-h-100">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(([id, name]) => (
              <th key={id}>
                <button onClick={() => onSort?.(id)}>
                  {name}
                  {sort === id ? (descending ? ' ↓' : ' ↑') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.label}
              data-selected={selected === entry.label}
              onClick={() => onSelect?.(entry.label)}
            >
              <td title={entry.label}>
                {onSelect ? (
                  <button onClick={() => onSelect(entry.label)}>{entry.label}</button>
                ) : (
                  entry.label
                )}
              </td>
              <td>{calcTraffic(entry.upload)}</td>
              <td>{calcTraffic(entry.download)}</td>
              <td>{calcTraffic(entry.total)}</td>
              <td>{entry.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
