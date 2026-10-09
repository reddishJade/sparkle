// Proxy workflows adapted from metacubexd; Sparkle's theme, native actions and node details are retained.
import { Button, InputGroup } from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import BasePage from '@renderer/components/base/base-page'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import ProxySettingDrawer from '@renderer/components/proxies/proxy-setting-drawer'
import ConnectivityBoard from '@renderer/components/proxies/connectivity-board'
import ProxyProvider from '@renderer/components/resources/proxy-provider'
import { useGroups } from '@renderer/hooks/use-groups'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import {
  mihomoChangeProxy,
  mihomoCloseConnections,
  mihomoProxyDelay,
  mihomoGroupDelay,
  mihomoUnfixedProxy
} from '@renderer/utils/ipc'
import { runDelayTestsWithConcurrency } from '@renderer/utils/delay-test'
import { notify } from '@renderer/utils/notification'
import {
  calculateNodeScore,
  findRecommendedNode,
  type NodePerformanceData
} from '@renderer/utils/node-scoring'

type Proxy = ControllerProxiesDetail | ControllerGroupDetail
const delay = (proxy: Proxy) => proxy.history.at(-1)?.delay ?? -1
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}
export default function Proxies() {
  const { groups = [], mutate } = useGroups()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const [tab, setTab] = useState('groups')
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    appConfig?.rememberProxyGroupOpenState ? read('proxy-expanded', {}) : {}
  )
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ total: number; complete: number }>()
  const [connectivity, setConnectivity] = useState(false)
  const [settings, setSettings] = useState(false)
  const [layout, setLayout] = useState<string>(() => read('proxy-view', 'card'))
  const [availability, setAvailability] = useState<string>(() => read('proxy-availability', 'all'))
  const [activeGroup, setActiveGroup] = useState('')
  const [autoSwitch, setAutoSwitch] = useState<boolean>(() => read('proxy-auto-recommend', false))
  const [performance, setPerformance] = useState<Record<string, NodePerformanceData>>(() =>
    read('proxy-performance', {})
  )
  const [excluded, setExcluded] = useState<string[]>(() => read('proxy-excluded', []))
  const sort = appConfig?.proxyDisplayOrder ?? 'default'
  useEffect(() => {
    localStorage.setItem('proxy-view', JSON.stringify(layout))
    localStorage.setItem('proxy-availability', JSON.stringify(availability))
    localStorage.setItem('proxy-auto-recommend', JSON.stringify(autoSwitch))
    localStorage.setItem('proxy-excluded', JSON.stringify(excluded))
  }, [layout, availability, autoSwitch, excluded])
  useEffect(() => {
    if (appConfig?.rememberProxyGroupOpenState)
      localStorage.setItem('proxy-expanded', JSON.stringify(expanded))
  }, [expanded, appConfig?.rememberProxyGroupOpenState])
  const shownGroups = useMemo(
    () =>
      groups.filter(
        (group) =>
          !group.hidden && (controledMihomoConfig?.mode !== 'global' || group.name === 'GLOBAL')
      ),
    [groups, controledMihomoConfig?.mode]
  )
  const renderedGroups = useMemo(
    () =>
      shownGroups.filter(
        (group) =>
          !filter ||
          [group.name, ...group.all.map((p) => p.name)].some((name) =>
            name.toLowerCase().includes(filter.toLowerCase())
          )
      ),
    [shownGroups, filter]
  )
  function nodes(group: ControllerMixedGroup): Proxy[] {
    let result = group.all.filter(
      (proxy) =>
        (!filter ||
          group.name.toLowerCase().includes(filter.toLowerCase()) ||
          proxy.name.toLowerCase().includes(filter.toLowerCase())) &&
        (availability === 'all' ||
          (availability === 'alive' ? proxy.alive !== false : proxy.alive === false))
    )
    if (sort === 'name') result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'delay')
      result = [...result].sort(
        (a, b) => (delay(a) > 0 ? delay(a) : Infinity) - (delay(b) > 0 ? delay(b) : Infinity)
      )
    return result
  }
  async function select(group: string, proxy: string): Promise<void> {
    try {
      await mihomoChangeProxy(group, proxy)
      if (appConfig?.autoCloseConnection ?? true)
        await mihomoCloseConnections(appConfig?.closeMode === 'group' ? group : undefined)
      mutate()
    } catch (error) {
      notify(error, { variant: 'danger' })
    }
  }
  function testURL(group?: ControllerMixedGroup): string | undefined {
    return appConfig?.delayTestUrlScope === 'global' ? undefined : group?.testUrl
  }
  function saveMeasurements(results: Record<string, number>): Record<string, NodePerformanceData> {
    const next = { ...read<Record<string, NodePerformanceData>>('proxy-performance', {}) }
    for (const [name, latency] of Object.entries(results))
      next[name] = {
        history: [
          { timestamp: Date.now(), latency: latency > 0 ? latency : null, success: latency > 0 },
          ...(next[name]?.history ?? [])
        ].slice(0, 20)
      }
    localStorage.setItem('proxy-performance', JSON.stringify(next))
    setPerformance(next)
    return next
  }
  async function testNode(
    proxy: Proxy,
    group?: ControllerMixedGroup
  ): Promise<ControllerProxiesDelay> {
    try {
      const result = await mihomoProxyDelay(
        proxy.name,
        testURL(group),
        'provider-name' in proxy ? proxy['provider-name'] : undefined
      )
      saveMeasurements({ [proxy.name]: result.delay ?? 0 })
      return result
    } catch (e) {
      saveMeasurements({ [proxy.name]: 0 })
      throw e
    }
  }
  async function testGroups(targets: ControllerMixedGroup[]): Promise<void> {
    if (busy.size) return
    setBusy(new Set(targets.map((group) => group.name)))
    const items = targets.flatMap((group) => nodes(group).map((proxy) => ({ group, proxy })))
    setProgress({ total: items.length, complete: 0 })
    const results: Record<string, number> = {}
    try {
      if (appConfig?.delayTestUseGroupApi) {
        await runDelayTestsWithConcurrency(targets, 3, async (group) => {
          try {
            const result = await mihomoGroupDelay(group.name, testURL(group))
            Object.assign(results, result)
          } catch (e) {
            notify(`${group.name} 测试失败：${e}`, { variant: 'danger' })
          }
        })
      } else {
        await runDelayTestsWithConcurrency(
          items,
          appConfig?.delayTestConcurrency,
          async ({ group, proxy }) => {
            try {
              const result = await mihomoProxyDelay(
                proxy.name,
                testURL(group),
                'provider-name' in proxy ? proxy['provider-name'] : undefined
              )
              results[proxy.name] = result.delay ?? 0
            } catch {
              results[proxy.name] = 0
            }
            setProgress((old) => (old ? { ...old, complete: old.complete + 1 } : old))
          }
        )
      }
      const next = saveMeasurements(results)
      if (autoSwitch)
        for (const group of targets) {
          const recommended = findRecommendedNode(
            group.all.filter((p) => (results[p.name] ?? 0) > 0).map((p) => p.name),
            new Map(Object.entries(next)),
            excluded
          )
          if (recommended && recommended !== group.now) await select(group.name, recommended)
        }
    } finally {
      mutate()
      setBusy(new Set())
      setProgress(undefined)
    }
  }
  const selectedGroup =
    renderedGroups.find((group) => group.name === activeGroup) ?? renderedGroups[0]
  function groupView(group: ControllerMixedGroup, forceOpen = false) {
    const items = nodes(group)
    const limit = limits[group.name] ?? 50
    const open = forceOpen || expanded[group.name] || Boolean(filter)
    const candidates = group.all
      .filter(
        (p) =>
          p.alive !== false && delay(p) !== 0 && (performance[p.name]?.history[0]?.success ?? false)
      )
      .map((p) => p.name)
    const recommended = findRecommendedNode(
      candidates,
      new Map(Object.entries(performance)),
      excluded
    )
    return (
      <section className="dashboard-panel proxy-group mb-3" key={group.name}>
        <div className="flex items-center justify-between gap-2">
          <button
            className="text-left min-w-0 flex-1"
            aria-expanded={open}
            onClick={() => setExpanded((old) => ({ ...old, [group.name]: !open }))}
          >
            <div className="font-semibold truncate">
              {group.name}{' '}
              <span className="text-xs text-foreground-500">
                {items.length} · {group.type}
              </span>
            </div>
            <div className="text-xs text-foreground-500 truncate mt-1">
              {open ? '⌄' : '›'} {group.now || '未选择'}
            </div>
          </button>
          <div className="flex gap-1 shrink-0">
            {group.fixed && (
              <Button
                size="sm"
                variant="ghost"
                onPress={async () => {
                  try {
                    await mihomoUnfixedProxy(group.name)
                    mutate()
                  } catch (e) {
                    notify(e, { variant: 'danger' })
                  }
                }}
              >
                取消固定
              </Button>
            )}
            {recommended && recommended !== group.now && (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => void select(group.name, recommended)}
              >
                推荐
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              isDisabled={busy.size > 0}
              onPress={() => void testGroups([group])}
            >
              {busy.has(group.name) ? '测试中…' : '测速'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setExpanded((old) => ({ ...old, [group.name]: true }))
                setLimits((old) => ({
                  ...old,
                  [group.name]: Math.max(limit, items.findIndex((p) => p.name === group.now) + 1)
                }))
                setTimeout(
                  () =>
                    document
                      .getElementById(`proxy-${group.name}-${group.now}`)
                      ?.scrollIntoView({ block: 'center' }),
                  50
                )
              }}
            >
              定位
            </Button>
          </div>
        </div>
        {open && (
          <div className="mt-3">
            {layout === 'table' ? (
              <div className="overflow-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>节点</th>
                      <th>类型</th>
                      <th>延迟</th>
                      <th>评分</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, limit).map((proxy) => (
                      <tr
                        id={`proxy-${group.name}-${proxy.name}`}
                        key={proxy.name}
                        data-selected={group.now === proxy.name}
                      >
                        <td>
                          <button onClick={() => void select(group.name, proxy.name)}>
                            {proxy.name}
                          </button>
                        </td>
                        <td>{proxy.type}</td>
                        <td>
                          {delay(proxy) > 0
                            ? `${delay(proxy)} ms`
                            : delay(proxy) === 0
                              ? '超时'
                              : '未测试'}
                        </td>
                        <td>
                          {performance[proxy.name]
                            ? calculateNodeScore(performance[proxy.name])
                            : '—'}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={async () => {
                              try {
                                await testNode(proxy, group)
                                mutate()
                              } catch (e) {
                                notify(e, { variant: 'danger' })
                              }
                            }}
                          >
                            测速
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                className={`grid gap-2 ${layout === 'list' ? 'grid-cols-1' : appConfig?.proxyCols === 'auto' || !appConfig?.proxyCols ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : ''}`}
                style={
                  layout !== 'list' && appConfig?.proxyCols && appConfig.proxyCols !== 'auto'
                    ? { gridTemplateColumns: `repeat(${appConfig.proxyCols},minmax(0,1fr))` }
                    : undefined
                }
              >
                {items.slice(0, limit).map((proxy) => (
                  <div id={`proxy-${group.name}-${proxy.name}`} key={proxy.name}>
                    <ProxyItem
                      proxy={proxy}
                      group={group}
                      selected={group.now === proxy.name}
                      onSelect={select}
                      onProxyDelay={testNode}
                      mutateProxies={mutate}
                      proxyDisplayLayout={appConfig?.proxyDisplayLayout ?? 'double'}
                      showGroupSelectedProxy={appConfig?.showGroupSelectedProxy ?? true}
                      showProxyDetailTooltip={appConfig?.showProxyDetailTooltip ?? true}
                    />
                    <div className="proxy-node-meta">
                      <span>
                        {proxy.name === recommended ? '推荐 · ' : ''}
                        {performance[proxy.name]
                          ? `评分 ${calculateNodeScore(performance[proxy.name])}`
                          : ''}
                      </span>
                      <button
                        className="proxy-exclude"
                        onClick={() =>
                          setExcluded((old) =>
                            old.includes(proxy.name)
                              ? old.filter((name) => name !== proxy.name)
                              : [...old, proxy.name]
                          )
                        }
                      >
                        {excluded.includes(proxy.name) ? '允许推荐' : '排除推荐'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!items.length && <p className="dashboard-empty">没有符合筛选条件的节点</p>}
            {items.length > limit && (
              <Button
                className="mt-3"
                size="sm"
                variant="ghost"
                onPress={() => setLimits((old) => ({ ...old, [group.name]: limit + 50 }))}
              >
                显示更多（{limit} / {items.length}）
              </Button>
            )}
          </div>
        )}
      </section>
    )
  }
  return (
    <BasePage
      title="代理"
      contentClassName="proxy-content flex flex-col overflow-hidden"
      header={
        <div className="flex gap-1 app-nodrag">
          <Button
            size="sm"
            variant={tab === 'groups' ? 'primary' : 'ghost'}
            onPress={() => setTab('groups')}
          >
            代理组
          </Button>
          <Button
            size="sm"
            variant={tab === 'providers' ? 'primary' : 'ghost'}
            onPress={() => setTab('providers')}
          >
            代理集合
          </Button>
          <Button size="sm" variant="ghost" onPress={() => setConnectivity(true)}>
            连通性
          </Button>
          <Button size="sm" variant="ghost" onPress={() => setSettings(true)}>
            设置
          </Button>
        </div>
      }
    >
      {connectivity && <ConnectivityBoard onClose={() => setConnectivity(false)} />}
      {settings && <ProxySettingDrawer onClose={() => setSettings(false)} />}
      {tab === 'providers' ? (
        <div className="overflow-auto">
          <ProxyProvider />
        </div>
      ) : (
        <>
          <div className="proxy-toolbar">
            <InputGroup className="min-w-40 flex-1">
              <InputGroup.Input
                aria-label="搜索代理"
                placeholder="搜索代理组或节点…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </InputGroup>
            <select
              className="dashboard-select"
              aria-label="节点排序"
              value={sort}
              onChange={(e) =>
                void patchAppConfig({
                  proxyDisplayOrder: e.target.value as 'default' | 'delay' | 'name'
                })
              }
            >
              <option value="default">原始顺序</option>
              <option value="delay">延迟</option>
              <option value="name">名称</option>
            </select>
            <select
              className="dashboard-select"
              aria-label="可用性"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            >
              <option value="all">全部节点</option>
              <option value="alive">可用节点</option>
              <option value="dead">不可用节点</option>
            </select>
            <select
              className="dashboard-select"
              aria-label="代理布局"
              value={layout}
              onChange={(e) => setLayout(e.target.value)}
            >
              {[
                ['card', '卡片'],
                ['list', '列表'],
                ['table', '表格'],
                ['master', '分栏']
              ].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="ghost"
              onPress={() =>
                setExpanded(
                  Object.fromEntries(
                    renderedGroups.map((group) => [
                      group.name,
                      !renderedGroups.some((g) => expanded[g.name])
                    ])
                  )
                )
              }
            >
              展开 / 折叠全部
            </Button>
            <Button
              size="sm"
              variant="primary"
              isDisabled={busy.size > 0}
              onPress={() => void testGroups(renderedGroups)}
            >
              {progress ? `${progress.complete} / ${progress.total}` : '全部测速'}
            </Button>
            <label className="text-xs flex items-center gap-1">
              <input
                type="checkbox"
                checked={autoSwitch}
                onChange={(e) => setAutoSwitch(e.target.checked)}
              />
              自动选优
            </label>
          </div>
          {controledMihomoConfig?.mode === 'direct' ? (
            <div className="dashboard-empty">直连模式</div>
          ) : !renderedGroups.length ? (
            <div className="dashboard-empty">
              {filter
                ? '没有匹配的代理组，请调整搜索条件。'
                : '暂无代理组，请先在订阅管理中导入并启用配置。'}
            </div>
          ) : layout === 'master' ? (
            <div className="flex min-h-0 flex-1">
              <div className="w-44 shrink-0 overflow-auto border-r border-border p-2">
                {renderedGroups.map((group) => (
                  <button
                    className={`w-full text-left p-2 rounded-lg text-sm ${selectedGroup?.name === group.name ? 'bg-primary/15 text-primary' : ''}`}
                    key={group.name}
                    onClick={() => setActiveGroup(group.name)}
                  >
                    {group.name}
                    <span className="block truncate text-xs text-foreground-500">{group.now}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 min-w-0 overflow-auto p-3">
                {selectedGroup && groupView(selectedGroup, true)}
              </div>
            </div>
          ) : (
            <Virtuoso
              className="flex-1"
              data={renderedGroups}
              itemContent={(_index, group) => <div className="px-3 pt-3">{groupView(group)}</div>}
            />
          )}
        </>
      )}
    </BasePage>
  )
}
