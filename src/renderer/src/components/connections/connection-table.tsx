// Connections table, quick filters and export adapted from metacubexd.
import { Button, InputGroup } from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import { calcTraffic } from '@renderer/utils/calc'
import { downloadText, csvField } from '@renderer/utils/download'
import { useQuickRuleMenu } from '@renderer/components/rules/quick-rule-provider'
import { connectionRuleCandidates } from '@renderer/utils/quick-rule'

type Column = {
  id: string
  label: string
  value: (connection: ControllerConnectionDetail) => string | number
  format?: (value: number) => string
}
const columns: Column[] = [
  { id: 'host', label: '目标', value: (c) => c.metadata.host || c.metadata.destinationIP },
  { id: 'process', label: '进程', value: (c) => c.metadata.process || c.metadata.processPath },
  { id: 'network', label: '网络', value: (c) => c.metadata.network },
  { id: 'type', label: '类型', value: (c) => c.metadata.type },
  { id: 'sourceIP', label: '源 IP', value: (c) => c.metadata.sourceIP },
  { id: 'sourcePort', label: '源端口', value: (c) => c.metadata.sourcePort },
  { id: 'destinationIP', label: '目标 IP', value: (c) => c.metadata.destinationIP },
  { id: 'destinationPort', label: '目标端口', value: (c) => c.metadata.destinationPort },
  { id: 'inboundUser', label: '用户', value: (c) => c.metadata.inboundUser },
  { id: 'chains', label: '代理链', value: (c) => [...c.chains].reverse().join(' → ') },
  {
    id: 'rule',
    label: '规则',
    value: (c) => `${c.rule}${c.rulePayload ? `: ${c.rulePayload}` : ''}`
  },
  { id: 'upload', label: '上传', value: (c) => c.upload, format: calcTraffic },
  { id: 'download', label: '下载', value: (c) => c.download, format: calcTraffic },
  {
    id: 'uploadSpeed',
    label: '上传速度',
    value: (c) => c.uploadSpeed ?? 0,
    format: (v) => `${calcTraffic(v)}/s`
  },
  {
    id: 'downloadSpeed',
    label: '下载速度',
    value: (c) => c.downloadSpeed ?? 0,
    format: (v) => `${calcTraffic(v)}/s`
  },
  { id: 'start', label: '开始时间', value: (c) => c.start }
]
function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}
export default function ConnectionTable({
  connections,
  onSelect,
  onClose
}: {
  connections: ControllerConnectionDetail[]
  onSelect: (connection: ControllerConnectionDetail) => void
  onClose: (id: string) => void
}) {
  const quickRule = useQuickRuleMenu()
  const [visible, setVisible] = useState<string[]>(() =>
    load('connection-columns', [
      'host',
      'process',
      'network',
      'chains',
      'rule',
      'uploadSpeed',
      'downloadSpeed',
      'upload',
      'download'
    ])
  )
  const [showSettings, setShowSettings] = useState(false)
  const [source, setSource] = useState('')
  const [quick, setQuick] = useState(() => load('connection-quick-filter', ''))
  const [quickEnabled, setQuickEnabled] = useState(false)
  const [groupBy, setGroupBy] = useState(() => load('connection-table-group', ''))
  const [sort, setSort] = useState(() => load('connection-table-sort', 'start'))
  const [desc, setDesc] = useState(true)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState<number>(() => load('connection-page-size', 50))
  const [collapsed, setCollapsed] = useState<string[]>([])
  useEffect(() => {
    localStorage.setItem('connection-columns', JSON.stringify(visible))
    localStorage.setItem('connection-quick-filter', JSON.stringify(quick))
    localStorage.setItem('connection-table-group', JSON.stringify(groupBy))
    localStorage.setItem('connection-table-sort', JSON.stringify(sort))
    localStorage.setItem('connection-page-size', JSON.stringify(size))
  }, [visible, quick, groupBy, sort, size])
  useEffect(() => setPage(0), [source, quick, quickEnabled, groupBy, size, sort, desc])
  const sources = [...new Set(connections.map((c) => c.metadata.sourceIP).filter(Boolean))].sort()
  const filtered = useMemo(() => {
    const terms = quick
      .replaceAll('\n', '|')
      .replaceAll(',', '|')
      .split('|')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    const column = columns.find((c) => c.id === sort)
    return connections
      .filter(
        (c) =>
          (!source || c.metadata.sourceIP === source) &&
          (!quickEnabled ||
            !terms.length ||
            c.chains.some((name) => terms.some((term) => name.toLowerCase().includes(term))))
      )
      .sort((a, b) => {
        if (!column) return 0
        const av = column.value(a) ?? '',
          bv = column.value(b) ?? ''
        return (
          (typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv))) * (desc ? -1 : 1)
        )
      })
  }, [connections, source, quickEnabled, quick, sort, desc])
  const totalPages = Math.max(1, Math.ceil(filtered.length / size))
  const currentPage = Math.min(page, totalPages - 1)
  const shown = filtered.slice(currentPage * size, (currentPage + 1) * size)
  const groupColumn = columns.find((c) => c.id === groupBy)
  const groups = useMemo(() => {
    const map = new Map<string, ControllerConnectionDetail[]>()
    for (const connection of shown) {
      const key = groupColumn ? String(groupColumn.value(connection) || '未知') : ''
      map.set(key, [...(map.get(key) ?? []), connection])
    }
    return [...map]
  }, [shown, groupColumn])
  const displayed = visible
    .map((id) => columns.find((c) => c.id === id))
    .filter((c): c is Column => Boolean(c))
  function exportCSV(): void {
    downloadText(
      'sparkle-connections.csv',
      'text/csv',
      [
        columns.map((c) => csvField(c.label)).join(','),
        ...filtered.map((connection) => columns.map((c) => csvField(c.value(connection))).join(','))
      ].join('\n')
    )
  }
  function move(id: string, offset: number): void {
    const next = [...visible],
      i = next.indexOf(id)
    if (i < 0 || i + offset < 0 || i + offset >= next.length) return
    ;[next[i], next[i + offset]] = [next[i + offset], next[i]]
    setVisible(next)
  }
  return (
    <div className="flex flex-col h-full">
      <div className="p-2 flex flex-wrap items-center gap-2 border-b border-border">
        <select
          className="dashboard-select"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="设备筛选"
        >
          <option value="">全部设备</option>
          {sources.map((ip) => (
            <option key={ip}>{ip}</option>
          ))}
        </select>
        <select
          className="dashboard-select"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value)}
          aria-label="连接分组"
        >
          <option value="">不分组</option>
          {columns
            .filter((c) => !c.format)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
        </select>
        <label className="text-xs flex items-center gap-1">
          <input
            type="checkbox"
            checked={quickEnabled}
            onChange={(e) => setQuickEnabled(e.target.checked)}
          />
          代理链快筛
        </label>
        {quickEnabled && (
          <InputGroup className="w-44">
            <InputGroup.Input
              aria-label="代理链快筛条件"
              placeholder="节点或组名，用逗号分隔"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
            />
          </InputGroup>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onPress={() => setShowSettings(!showSettings)}>
          列设置
        </Button>
        <Button size="sm" variant="ghost" onPress={exportCSV}>
          CSV
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onPress={() =>
            downloadText(
              'sparkle-connections.json',
              'application/json',
              JSON.stringify(filtered, null, 2)
            )
          }
        >
          JSON
        </Button>
      </div>
      {showSettings && (
        <div className="p-3 flex flex-wrap gap-3 border-b border-border">
          {columns.map((column) => (
            <div className="flex items-center gap-1 text-xs" key={column.id}>
              <label>
                <input
                  type="checkbox"
                  checked={visible.includes(column.id)}
                  onChange={(e) =>
                    setVisible(
                      e.target.checked
                        ? [...visible, column.id]
                        : visible.length > 1
                          ? visible.filter((id) => id !== column.id)
                          : visible
                    )
                  }
                />{' '}
                {column.label}
              </label>
              {visible.includes(column.id) && (
                <>
                  <button aria-label={`左移${column.label}`} onClick={() => move(column.id, -1)}>
                    ←
                  </button>
                  <button aria-label={`右移${column.label}`} onClick={() => move(column.id, 1)}>
                    →
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="overflow-auto flex-1 min-h-0">
        <table className="data-table">
          <thead>
            <tr>
              {displayed.map((column) => (
                <th
                  aria-sort={sort === column.id ? (desc ? 'descending' : 'ascending') : 'none'}
                  key={column.id}
                >
                  <button
                    onClick={() => {
                      if (sort === column.id) setDesc(!desc)
                      else {
                        setSort(column.id)
                        setDesc(true)
                      }
                    }}
                  >
                    {column.label}
                    {sort === column.id ? (desc ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([name, items]) => (
              <GroupRows
                key={name}
                name={name}
                items={items}
                columns={displayed}
                grouped={Boolean(groupColumn)}
                collapsed={collapsed.includes(name)}
                onCollapse={() =>
                  setCollapsed(
                    collapsed.includes(name)
                      ? collapsed.filter((n) => n !== name)
                      : [...collapsed, name]
                  )
                }
                onSelect={onSelect}
                onClose={onClose}
                onContext={(event, connection) => {
                  quickRule(event, connectionRuleCandidates(connection.metadata))
                }}
              />
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="dashboard-empty">暂无符合条件的连接</p>}
      </div>
      <div className="p-2 border-t border-border flex items-center justify-between gap-2 text-xs">
        <span>
          {filtered.length} 条 · 第 {currentPage + 1} / {totalPages} 页
        </span>
        <div className="flex items-center gap-2">
          <select
            className="dashboard-select"
            aria-label="每页数量"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={currentPage === 0}
            onPress={() => setPage(currentPage - 1)}
          >
            上一页
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={currentPage >= totalPages - 1}
            onPress={() => setPage(currentPage + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  )
}
function GroupRows({
  name,
  items,
  columns,
  grouped,
  collapsed,
  onCollapse,
  onSelect,
  onClose,
  onContext
}: {
  name: string
  items: ControllerConnectionDetail[]
  columns: Column[]
  grouped: boolean
  collapsed: boolean
  onCollapse: () => void
  onSelect: (connection: ControllerConnectionDetail) => void
  onClose: (id: string) => void
  onContext: (event: React.MouseEvent, connection: ControllerConnectionDetail) => void
}) {
  return (
    <>
      {grouped && (
        <tr>
          <td colSpan={columns.length + 1}>
            <button onClick={onCollapse}>
              {collapsed ? '›' : '⌄'} {name} · {items.length} 条
            </button>
          </td>
        </tr>
      )}
      {!collapsed &&
        items.map((connection) => (
          <tr
            key={connection.id}
            onDoubleClick={() => onSelect(connection)}
            onContextMenu={(event) => onContext(event, connection)}
          >
            {columns.map((column, index) => {
              const value = column.value(connection) ?? ''
              const text = column.format ? column.format(Number(value)) : String(value)
              return (
                <td key={column.id} title={text}>
                  {index === 0 ? (
                    <button onClick={() => onSelect(connection)}>{text}</button>
                  ) : (
                    text
                  )}
                </td>
              )
            })}
            <td>
              <Button
                size="sm"
                variant="ghost"
                aria-label={connection.isActive ? '关闭连接' : '删除记录'}
                onPress={() => onClose(connection.id)}
              >
                {connection.isActive ? '关闭' : '删除'}
              </Button>
            </td>
          </tr>
        ))}
    </>
  )
}
