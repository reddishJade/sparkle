// Service reachability board adapted from metacubexd useReachabilityBoard.
import { Button, Modal } from '@heroui/react'
import { useEffect, useState } from 'react'
import { useGroups } from '@renderer/hooks/use-groups'
import { mihomoProxyDelay } from '@renderer/utils/ipc'
const targets = {
  general: [
    ['Google', 'https://www.google.com/generate_204'],
    ['Cloudflare', 'https://cp.cloudflare.com/generate_204'],
    ['GitHub', 'https://github.com']
  ],
  services: [
    ['YouTube', 'https://www.youtube.com/generate_204'],
    ['Netflix', 'https://www.netflix.com'],
    ['Disney+', 'https://www.disneyplus.com'],
    ['OpenAI', 'https://chat.openai.com'],
    ['Gemini', 'https://gemini.google.com']
  ]
}
export default function ConnectivityBoard({ onClose }: { onClose: () => void }) {
  const { groups = [] } = useGroups()
  const names = [
    ...new Set(groups.flatMap((group) => [group.name, ...group.all.map((node) => node.name)]))
  ]
  const [node, setNode] = useState(names[0] ?? '')
  const [category, setCategory] = useState<keyof typeof targets>('general')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Record<string, number | null>>({})
  useEffect(() => setResults({}), [node, category])
  async function test(): Promise<void> {
    setBusy(true)
    setResults({})
    try {
      await Promise.all(
        targets[category].map(async ([name, url]) => {
          let latency: number | null = null
          try {
            const result = await mihomoProxyDelay(node, url)
            latency = result.delay && result.delay > 0 ? result.delay : null
          } catch {
            /* show failed target */
          }
          setResults((old) => ({ ...old, [name]: latency }))
        })
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-140 max-w-[calc(100vw-32px)]">
            <Modal.Header>
              <Modal.Heading>节点连通性</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-wrap gap-2">
                <select
                  className="dashboard-select flex-1"
                  aria-label="连通性测试节点"
                  value={node}
                  disabled={busy}
                  onChange={(event) => setNode(event.target.value)}
                >
                  {names.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <Button size="sm" isDisabled={busy || !node} onPress={() => void test()}>
                  {busy ? '测试中…' : '开始测试'}
                </Button>
              </div>
              <div className="flex gap-2 my-3">
                <Button
                  size="sm"
                  variant={category === 'general' ? 'primary' : 'ghost'}
                  isDisabled={busy}
                  onPress={() => setCategory('general')}
                >
                  网络服务
                </Button>
                <Button
                  size="sm"
                  variant={category === 'services' ? 'primary' : 'ghost'}
                  isDisabled={busy}
                  onPress={() => setCategory('services')}
                >
                  流媒体 / AI
                </Button>
              </div>
              {category === 'services' && (
                <p className="text-xs text-foreground-500 mb-3">
                  结果表示所选节点能否连接服务，不代表地区解锁或账户可用性。
                </p>
              )}
              {targets[category].map(([name]) => (
                <div
                  className="flex justify-between py-3 border-b border-border text-sm"
                  key={name}
                >
                  <span>{name}</span>
                  <span className={results[name] === null ? 'text-danger' : 'text-foreground-500'}>
                    {results[name] === undefined
                      ? busy
                        ? '测试中…'
                        : '未测试'
                      : results[name] === null
                        ? '无法连接'
                        : `${results[name]} ms`}
                  </span>
                </div>
              ))}
            </Modal.Body>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
