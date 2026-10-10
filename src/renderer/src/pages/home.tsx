// Overview functionality adapted from metacubexd; Sparkle theme and IPC are retained.
import {
  FiArrowUpRight,
  FiArrowDownLeft,
  FiActivity,
  FiCpu,
  FiSettings,
  FiEdit2,
  FiCheck
} from 'react-icons/fi'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Switch } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import HomeWidgetLayout, {
  defaultHomeWidgets,
  homeWidgetLabels,
  normalizeHomeWidgets
} from '@renderer/components/home/home-widget-layout'
import PageViewSettings from '@renderer/components/base/page-view-settings'
import DashboardSelect from '@renderer/components/base/dashboard-select'
import { useNavigate } from 'react-router-dom'
import BasePage from '@renderer/components/base/base-page'
import NetworkTopology from '@renderer/components/home/network-topology'
import HistoryChart from '@renderer/components/home/history-chart'
import NetworkLatency from '@renderer/components/home/network-latency'
import ServiceReachability from '@renderer/components/home/service-reachability'
import NetworkInfo from '@renderer/components/home/network-info'
import { useLiveData } from '@renderer/hooks/use-live-data'
import { calcTraffic } from '@renderer/utils/calc'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
const bytes = (value: number) => calcTraffic(value)
export default function Home() {
  const live = useLiveData()
  const navigate = useNavigate()
  const { appConfig, patchAppConfig } = useAppConfig()
  const [widgets, setWidgets] = useState(() => normalizeHomeWidgets(appConfig?.homeWidgets))
  const [editing, setEditing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  useEffect(
    () => setWidgets(normalizeHomeWidgets(appConfig?.homeWidgets)),
    [appConfig?.homeWidgets]
  )
  async function saveWidgets(next: HomeWidgetConfig[]): Promise<void> {
    const previous = widgets
    setWidgets(next)
    if (!(await patchAppConfig({ homeWidgets: next }))) setWidgets(previous)
  }
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
      id: 'download',
      label: '下载速度',
      value: `${bytes(live.traffic.down)}/s`,
      detail: `累计 ${bytes(live.connections.downloadTotal)}`,
      Icon: FiArrowDownLeft,
      series: live.history.map((s) => s.down),
      format: (v: number) => `${bytes(v)}/s`
    },
    {
      id: 'upload',
      label: '上传速度',
      value: `${bytes(live.traffic.up)}/s`,
      detail: `累计 ${bytes(live.connections.uploadTotal)}`,
      Icon: FiArrowUpRight,
      series: live.history.map((s) => s.up),
      format: (v: number) => `${bytes(v)}/s`
    },
    {
      id: 'connections',
      label: '活动连接',
      value: String(connections.length),
      detail: `TCP ${tcp} / UDP ${connections.length - tcp}`,
      Icon: FiActivity,
      series: live.history.map((s) => s.connections),
      format: (v: number) => String(Math.round(v))
    },
    {
      id: 'memory',
      label: '内核内存',
      value: bytes(live.memory),
      detail: 'Mihomo',
      Icon: FiCpu,
      series: live.history.map((s) => s.memory),
      format: bytes
    }
  ]
  const content: Record<string, ReactNode> = Object.fromEntries(
    metrics.map(({ id, label, value, detail, Icon, series, format }) => [
      id,
      <section className="dashboard-panel home-monitor-item" key={id}>
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
    ])
  )
  content.traffic = (
    <section className="dashboard-panel home-traffic-trend">
      <h2>实时流量</h2>
      <HistoryChart
        timestamps={live.history.map((s) => s.time)}
        series={[live.history.map((s) => s.down), live.history.map((s) => s.up)]}
        labels={['下载', '上传']}
        format={(value) => `${bytes(value)}/s`}
      />
    </section>
  )
  content.topology = <NetworkTopology connections={connections} />
  content.active = (
    <section className="dashboard-panel home-unit">
      <div className="home-unit-heading">
        <h2>活跃节点</h2>
      </div>
      <div className="home-unit-body">
        {topProxies.length ? (
          topProxies.map(([name, speed]) => (
            <button key={name} className="dashboard-rank" onClick={() => navigate('/connections')}>
              <span className="truncate">{name}</span>
              <span>{bytes(speed)}/s</span>
            </button>
          ))
        ) : (
          <p className="dashboard-empty">暂无活动连接</p>
        )}
      </div>
    </section>
  )
  content.ip = <NetworkInfo />
  content.latency = <NetworkLatency />
  content.services = <ServiceReachability />
  return (
    <BasePage
      title="主页"
      header={
        <>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={editing ? '完成主页编辑' : '编辑主页布局'}
            onPress={() => setEditing(!editing)}
          >
            {editing ? <FiCheck /> : <FiEdit2 />}
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="主页组件设置"
            onPress={() => setSettingsOpen(true)}
          >
            <FiSettings />
          </Button>
        </>
      }
    >
      {settingsOpen && (
        <PageViewSettings title="主页组件设置" onClose={() => setSettingsOpen(false)}>
          {widgets.map((widget) => (
            <div className="home-widget-setting" key={widget.id}>
              <Switch
                aria-label={`显示${homeWidgetLabels[widget.id]}`}
                isSelected={!widget.hidden}
                onChange={(value) =>
                  void saveWidgets(
                    widgets.map((item) =>
                      item.id === widget.id ? { ...item, hidden: !value } : item
                    )
                  )
                }
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span>{homeWidgetLabels[widget.id]}</span>
                </Switch.Content>
              </Switch>
              <div className="flex gap-2">
                <DashboardSelect
                  label={`${homeWidgetLabels[widget.id]}宽度`}
                  value={String(widget.span)}
                  options={[
                    ['3', '四分之一'],
                    ['6', '二分之一'],
                    ['9', '四分之三'],
                    ['12', '整行']
                  ]}
                  onChange={(value) =>
                    void saveWidgets(
                      widgets.map((item) =>
                        item.id === widget.id
                          ? { ...item, span: Number(value) as HomeWidgetConfig['span'] }
                          : item
                      )
                    )
                  }
                />
                <DashboardSelect
                  label={`${homeWidgetLabels[widget.id]}高度`}
                  value={String(widget.height)}
                  options={[
                    ['144', '小'],
                    ['208', '紧凑'],
                    ['280', '标准'],
                    ['360', '大']
                  ]}
                  onChange={(value) =>
                    void saveWidgets(
                      widgets.map((item) =>
                        item.id === widget.id
                          ? { ...item, height: Number(value) as HomeWidgetConfig['height'] }
                          : item
                      )
                    )
                  }
                />
              </div>
            </div>
          ))}
          <Button variant="secondary" onPress={() => void saveWidgets(defaultHomeWidgets)}>
            恢复默认布局
          </Button>
        </PageViewSettings>
      )}
      <div className="dashboard-content home-content">
        <div className="home-status">
          <span className={`home-status-label ${live.connected ? 'is-connected' : ''}`}>
            <i />
            {live.connected ? '已连接到 Mihomo' : '等待内核连接…'}
          </span>
          <span>{controledMihomoConfig?.['external-controller']}</span>
        </div>
        <HomeWidgetLayout
          widgets={widgets}
          editing={editing}
          content={content}
          onChange={(next) => void saveWidgets(next)}
        />
      </div>
    </BasePage>
  )
}
