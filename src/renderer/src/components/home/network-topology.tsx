import { Button } from '@heroui/react'
import { useMemo, useState } from 'react'
import { buildTopology, type TopologyNode } from './topology-data'
import { calcTraffic } from '@renderer/utils/calc'

const labels = {
  root: '连接',
  group: '策略组',
  proxy: '节点',
  rule: '规则',
  client: '设备',
  port: '端口'
}
export default function NetworkTopology({
  connections
}: {
  connections: ControllerConnectionDetail[]
}) {
  const [frozen, setFrozen] = useState<ControllerConnectionDetail[] | null>(null)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [zoom, setZoom] = useState(1)
  const [selected, setSelected] = useState<TopologyNode>()
  const tree = useMemo(() => buildTopology(frozen ?? connections), [frozen, connections])
  const { nodes, links, height, width } = useMemo(() => {
    const nodes: Array<{ node: TopologyNode; x: number; y: number; expanded: boolean }> = []
    const links: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    let row = 0
    function walk(node: TopologyNode, depth: number): { x: number; y: number } {
      const expanded = overrides[node.id] ?? (node.type !== 'rule' && node.type !== 'client')
      const children = expanded ? node.children.map((child) => walk(child, depth + 1)) : []
      const y = children.length
        ? (children[0].y + children[children.length - 1].y) / 2
        : row++ * 76 + 38
      const x = depth * 220 + 20
      nodes.push({ node, x, y, expanded })
      children.forEach((child) => links.push({ x1: x + 180, y1: y, x2: child.x, y2: child.y }))
      return { x, y }
    }
    walk(tree, 0)
    return {
      nodes,
      links,
      height: Math.max(240, row * 76 + 20),
      width: Math.max(...nodes.map(({ x }) => x + 200))
    }
  }, [tree, overrides])
  return (
    <section className="dashboard-panel topology-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2>网络拓扑</h2>
          <p className="text-xs text-foreground-500">
            {tree.count} 条活动连接 · {calcTraffic(tree.traffic)}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={frozen ? 'primary' : 'ghost'}
            onPress={() => setFrozen(frozen ? null : structuredClone(connections))}
          >
            {frozen ? '继续' : '暂停'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => setZoom(Math.max(0.4, zoom - 0.1))}
            aria-label="缩小"
          >
            −
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => setZoom(Math.min(2, zoom + 0.1))}
            aria-label="放大"
          >
            +
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setZoom(1)
              setOverrides({})
              setSelected(undefined)
            }}
          >
            重置
          </Button>
        </div>
      </div>
      {tree.count === 0 ? (
        <div className="dashboard-empty">暂无活动连接。产生代理流量后，拓扑会自动更新。</div>
      ) : (
        <div className="topology-viewport">
          <div className="topology-columns" style={{ width: width * zoom }}>
            {['连接', '策略组', '节点', '规则', '设备', '端口']
              .slice(0, Math.round(width / 220))
              .map((label) => (
                <span key={label} style={{ width: 220 * zoom }}>
                  {label}
                </span>
              ))}
          </div>
          <svg
            width={width * zoom}
            height={height * zoom}
            viewBox={`0 0 ${width} ${height}`}
            aria-label="实时网络拓扑"
          >
            {links.map((link, i) => (
              <path
                key={i}
                d={`M${link.x1},${link.y1} C${link.x1 + 20},${link.y1} ${link.x2 - 20},${link.y2} ${link.x2},${link.y2}`}
                fill="none"
                stroke="var(--border)"
                strokeWidth="2"
              />
            ))}
            {nodes.map(({ node, x, y, expanded }) => (
              <foreignObject key={node.id} x={x} y={y - 28} width="180" height="60">
                <button
                  type="button"
                  className={`topology-node ${selected?.id === node.id ? 'selected' : ''}`}
                  title={`${node.name}\n${node.count} 条连接 · ${calcTraffic(node.traffic)}`}
                  aria-expanded={node.children.length ? expanded : undefined}
                  onClick={() => {
                    setSelected(node)
                    if (node.children.length)
                      setOverrides((old) => ({ ...old, [node.id]: !expanded }))
                  }}
                >
                  <span className="topology-node-kind" aria-hidden="true">
                    {node.children.length ? (expanded ? '−' : '+') : ''}
                  </span>
                  <span className="truncate block font-medium">{node.name}</span>
                  <span className="text-xs text-foreground-500">
                    {node.count} 条 · {calcTraffic(node.traffic)}
                  </span>
                </button>
              </foreignObject>
            ))}
          </svg>
        </div>
      )}
      {selected && (
        <div className="mt-2 text-sm break-all text-foreground-500">
          {labels[selected.type]}：{selected.name} · {selected.count} 条连接 ·{' '}
          {calcTraffic(selected.traffic)}
        </div>
      )}
    </section>
  )
}
