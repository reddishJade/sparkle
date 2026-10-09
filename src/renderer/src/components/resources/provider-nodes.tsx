import { Button, InputGroup } from '@heroui/react'
import DashboardSelect from '@renderer/components/base/dashboard-select'
import { MdOutlineSpeed } from 'react-icons/md'
import { useState } from 'react'
import { mihomoProxyDelay } from '@renderer/utils/ipc'
import { runDelayTestsWithConcurrency } from '@renderer/utils/delay-test'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { notify } from '@renderer/utils/notification'
export default function ProviderNodes({
  provider,
  refresh
}: {
  provider: ControllerProxyProviderDetail
  refresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('default')
  const [limit, setLimit] = useState(50)
  const [testing, setTesting] = useState(false)
  const { appConfig } = useAppConfig()
  const { mutate } = useGroups()
  const latency = (proxy: ControllerProxiesDetail) => proxy.history.at(-1)?.delay ?? -1
  let nodes = (provider.proxies ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )
  if (sort === 'delay')
    nodes = [...nodes].sort(
      (a, b) => (latency(a) > 0 ? latency(a) : Infinity) - (latency(b) > 0 ? latency(b) : Infinity)
    )
  if (sort === 'name') nodes = [...nodes].sort((a, b) => a.name.localeCompare(b.name))
  async function test(items: ControllerProxiesDetail[]): Promise<void> {
    setTesting(true)
    try {
      await runDelayTestsWithConcurrency(items, appConfig?.delayTestConcurrency, async (proxy) => {
        try {
          await mihomoProxyDelay(proxy.name, provider.testUrl, provider.name)
        } catch (e) {
          if (items.length === 1) notify(e, { variant: 'danger' })
        }
      })
      refresh()
      mutate()
    } finally {
      setTesting(false)
    }
  }
  return (
    <div className="provider-nodes">
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" aria-expanded={open} onPress={() => setOpen(!open)}>
          {open ? '收起节点' : `查看节点 (${provider.proxies?.length ?? 0})`}
        </Button>
        <Button size="sm" variant="ghost" isDisabled={testing} onPress={() => void test(nodes)}>
          {testing ? '测试中…' : '延迟测试'}
        </Button>
      </div>
      {open && (
        <>
          <div className="flex gap-2 my-2">
            <InputGroup className="flex-1">
              <InputGroup.Input
                placeholder="搜索节点…"
                aria-label="搜索集合节点"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setLimit(50)
                }}
              />
            </InputGroup>
            <DashboardSelect
              label="集合节点排序"
              value={sort}
              options={[
                ['default', '原始顺序'],
                ['name', '名称'],
                ['delay', '延迟']
              ]}
              onChange={setSort}
              className="w-28"
            />
          </div>
          <div className="provider-node-list">
            <table className="provider-node-table">
              <thead>
                <tr>
                  <th>节点</th>
                  <th>类型</th>
                  <th>延迟</th>
                </tr>
              </thead>
              <tbody>
                {nodes.slice(0, limit).map((proxy) => (
                  <tr key={proxy.name}>
                    <td title={proxy.name}>
                      <span className="block truncate">{proxy.name}</span>
                    </td>
                    <td>
                      <span>{proxy.type}</span>
                      <span className="provider-udp">{proxy.udp ? 'UDP' : ''}</span>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`${proxy.name} 延迟测试`}
                        isDisabled={testing}
                        onPress={() => void test([proxy])}
                      >
                        <span className="tabular-nums">
                          {latency(proxy) > 0
                            ? `${latency(proxy)} ms`
                            : latency(proxy) === 0
                              ? '超时'
                              : '未测试'}
                        </span>
                        <MdOutlineSpeed />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!nodes.length && <p className="dashboard-empty">没有匹配的节点</p>}
          </div>
          {nodes.length > limit && (
            <Button size="sm" variant="ghost" onPress={() => setLimit(limit + 50)}>
              显示更多
            </Button>
          )}
        </>
      )}
    </div>
  )
}
