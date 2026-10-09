// Overview functionality adapted from metacubexd; Sparkle theme and IPC are retained.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import BasePage from '@renderer/components/base/base-page'
import NetworkTopology from '@renderer/components/home/network-topology'
import HistoryChart from '@renderer/components/home/history-chart'
import NetworkInfo from '@renderer/components/home/network-info'
import { useLiveData } from '@renderer/hooks/use-live-data'
import { calcTraffic } from '@renderer/utils/calc'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
const bytes = (value: number) => calcTraffic(value)
export default function Home() {
  const live = useLiveData()
  const navigate = useNavigate()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const connections = live.connections.connections ?? []
  const topProxies = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of connections) {
      const name = c.chains?.[0] || 'DIRECT'
      map.set(name, (map.get(name) || 0) + (c.uploadSpeed || 0) + (c.downloadSpeed || 0))
    }
    return [...map].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [connections])
  const tcp = connections.filter((c) => c.metadata.network === 'tcp').length
  const metrics = [
    ['上传速度', `${bytes(live.traffic.up)}/s`],
    ['下载速度', `${bytes(live.traffic.down)}/s`],
    ['累计上传', bytes(live.connections.uploadTotal)],
    ['累计下载', bytes(live.connections.downloadTotal)],
    ['活动连接', String(connections.length)],
    ['内核内存', bytes(live.memory)]
  ]
  return (
    <BasePage title="主页">
      <div className="dashboard-content home-content">
        <div className="home-status">
          <span className={`home-status-label ${live.connected ? 'is-connected' : ''}`}>
            <i />
            {live.connected ? '已连接到 Mihomo' : '等待内核连接…'}
          </span>
          <span>{controledMihomoConfig?.['external-controller']}</span>
        </div>
        <div className="dashboard-metrics metric-strip">
          {metrics.map(([label, value]) => (
            <div className="dashboard-panel" key={label}>
              <div className="text-xs text-foreground-500 mb-2">{label}</div>
              <div className="text-lg font-semibold tabular-nums">{value}</div>
            </div>
          ))}
        </div>
        <NetworkTopology connections={connections} />
        <div className="home-charts">
          <section className="dashboard-panel">
            <h2>实时流量</h2>
            <HistoryChart
              timestamps={live.history.map((sample) => sample.time)}
              series={[live.history.map((s) => s.down), live.history.map((s) => s.up)]}
              labels={['下载', '上传']}
              format={(v) => `${bytes(v)}/s`}
            />
          </section>
          <section className="dashboard-panel">
            <h2>内存</h2>
            <HistoryChart
              timestamps={live.history.map((sample) => sample.time)}
              series={[live.history.map((s) => s.memory)]}
              labels={['内核内存']}
              format={bytes}
            />
          </section>
          <section className="dashboard-panel">
            <h2>连接数</h2>
            <HistoryChart
              timestamps={live.history.map((sample) => sample.time)}
              series={[live.history.map((s) => s.connections)]}
              labels={['活动连接']}
              format={(v) => String(Math.round(v))}
            />
          </section>
        </div>
        <div className="home-details">
          <section className="dashboard-panel">
            <h2>流量分布</h2>
            <Distribution
              entries={[
                ['下载', live.connections.downloadTotal],
                ['上传', live.connections.uploadTotal]
              ]}
              format={bytes}
            />
          </section>
          <section className="dashboard-panel">
            <h2>网络类型</h2>
            <Distribution
              entries={[
                ['TCP', tcp],
                ['UDP', connections.length - tcp]
              ]}
              format={String}
            />
          </section>
          <section className="dashboard-panel">
            <h2>活跃节点</h2>
            {topProxies.length ? (
              topProxies.map(([name, speed]) => (
                <button
                  key={name}
                  className="dashboard-rank"
                  onClick={() => navigate('/connections')}
                >
                  <span className="truncate">{name}</span>
                  <span>{bytes(speed)}/s</span>
                </button>
              ))
            ) : (
              <p className="dashboard-empty">暂无活动连接</p>
            )}
          </section>
        </div>
        <NetworkInfo />
      </div>
    </BasePage>
  )
}
function Distribution({
  entries,
  format
}: {
  entries: Array<[string, number]>
  format: (value: number) => string
}) {
  const total = entries.reduce((sum, [, value]) => sum + value, 0)
  return (
    <div className="distribution">
      <div
        className="distribution-ring"
        style={{
          background: total
            ? `conic-gradient(var(--accent) ${(entries[0][1] / total) * 100}%, var(--success) 0)`
            : 'var(--surface-secondary)'
        }}
      >
        <span>{format(total)}</span>
      </div>
      <div className="flex-1">
        {entries.map(([name, value], index) => (
          <div key={name} className="flex justify-between gap-2 my-3 text-sm">
            <span style={{ color: index ? 'var(--success)' : 'var(--accent)' }}>{name}</span>
            <span>
              {format(value)} · {total ? ((value / total) * 100).toFixed(1) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
