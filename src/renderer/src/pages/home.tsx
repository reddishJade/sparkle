// Overview functionality adapted from metacubexd; Sparkle theme and IPC are retained.
import { FiArrowUpRight, FiArrowDownLeft, FiActivity, FiCpu } from 'react-icons/fi'
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
    {
      label: '下载速度',
      value: `${bytes(live.traffic.down)}/s`,
      detail: `累计 ${bytes(live.connections.downloadTotal)}`,
      Icon: FiArrowDownLeft,
      series: live.history.map((s) => s.down),
      format: (v: number) => `${bytes(v)}/s`
    },
    {
      label: '上传速度',
      value: `${bytes(live.traffic.up)}/s`,
      detail: `累计 ${bytes(live.connections.uploadTotal)}`,
      Icon: FiArrowUpRight,
      series: live.history.map((s) => s.up),
      format: (v: number) => `${bytes(v)}/s`
    },
    {
      label: '活动连接',
      value: String(connections.length),
      detail: `TCP ${tcp} / UDP ${connections.length - tcp}`,
      Icon: FiActivity,
      series: live.history.map((s) => s.connections),
      format: (v: number) => String(Math.round(v))
    },
    {
      label: '内核内存',
      value: bytes(live.memory),
      detail: 'Mihomo',
      Icon: FiCpu,
      series: live.history.map((s) => s.memory),
      format: bytes
    }
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
        <div className="home-monitor">
          {metrics.map(({ label, value, detail, Icon, series, format }) => (
            <section className="home-monitor-item" key={label}>
              <span className="home-monitor-label">
                <Icon />
                {label}
              </span>
              <strong>{value}</strong>
              <span className="home-monitor-detail">{detail}</span>
              <HistoryChart
                timestamps={live.history.map((s) => s.time)}
                series={[series]}
                labels={[label]}
                format={format}
              />
            </section>
          ))}
        </div>
        <NetworkTopology connections={connections} />
        <div className="home-secondary">
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
          <NetworkInfo />
        </div>
      </div>
    </BasePage>
  )
}
