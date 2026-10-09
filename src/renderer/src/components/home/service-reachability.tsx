// metacubexd streaming/AI reachability uses Mihomo's delay probe through a selected group/node.
import { Button } from '@heroui/react'
import { useEffect, useState } from 'react'
import { FiPlay, FiSettings } from 'react-icons/fi'
import { streamingTargets } from '../../../../shared/network-targets'
import { useGroups } from '@renderer/hooks/use-groups'
import { mihomoProxyDelay } from '@renderer/utils/ipc'
import DashboardSelect from '../base/dashboard-select'
import ProbeTargetsDialog from './probe-targets-dialog'
import { readTargets } from './probe-preferences'
export default function ServiceReachability() {
  const { groups = [] } = useGroups()
  const [targets, setTargets] = useState(() =>
    readTargets('home-service-targets', streamingTargets)
  )
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('home-service-selected') ?? 'null')
      if (
        Array.isArray(saved) &&
        new Set(saved).size === 4 &&
        saved.every((name) => targets.some((target) => target.name === name))
      )
        return saved
    } catch {
      /* use presets */
    }
    return ['YouTube', 'Netflix', 'OpenAI', 'Gemini'].every((name) =>
      targets.some((target) => target.name === name)
    )
      ? ['YouTube', 'Netflix', 'OpenAI', 'Gemini']
      : targets.slice(0, 4).map((target) => target.name)
  })
  const names = [
    ...new Set(groups.flatMap((group) => [group.name, ...group.all.map((node) => node.name)]))
  ]
  const [node, setNode] = useState(() => localStorage.getItem('home-service-node') ?? '')
  const currentNode = names.includes(node) ? node : (names[0] ?? '')
  const [results, setResults] = useState<Record<string, number | null>>({})
  const [testing, setTesting] = useState(false)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    setResults({})
  }, [currentNode, targets, selected])
  async function test(): Promise<void> {
    if (!currentNode) return
    setTesting(true)
    setResults({})
    try {
      await Promise.all(
        targets
          .filter((target) => selected.includes(target.name))
          .map(async (target) => {
            let delay: number | null = null
            try {
              const result = await mihomoProxyDelay(currentNode, target.url)
              delay = typeof result.delay === 'number' && result.delay > 0 ? result.delay : null
            } catch {
              /* one failed service must not cancel other probes */
            }
            setResults((previous) => ({ ...previous, [target.name]: delay }))
          })
      )
    } finally {
      setTesting(false)
    }
  }
  return (
    <section className="dashboard-panel home-unit">
      <div className="home-unit-heading">
        <h2>流媒体 / AI</h2>
        <div className="flex gap-1">
          <Button
            size="sm"
            isIconOnly
            aria-label="选择流媒体 AI 检测项目"
            variant="ghost"
            isDisabled={testing}
            onPress={() => setEditing(true)}
          >
            <FiSettings />
          </Button>
          <Button
            size="sm"
            isIconOnly
            aria-label="开始流媒体 AI 检测"
            variant="ghost"
            isDisabled={testing || !currentNode}
            onPress={() => void test()}
          >
            <FiPlay />
          </Button>
        </div>
      </div>
      <div className="home-unit-body">
        <DashboardSelect
          label="检测节点或分组"
          className="w-full mb-2"
          value={currentNode}
          isDisabled={testing || !names.length}
          options={names.map((name) => [name, name])}
          onChange={(value) => {
            localStorage.setItem('home-service-node', value)
            setNode(value)
          }}
        />
        {selected.map((name) => (
          <div key={name} className="home-unit-row">
            <span className="truncate">{name}</span>
            <span
              className={
                results[name] === null
                  ? 'text-danger'
                  : results[name] > 0
                    ? 'text-success'
                    : 'text-foreground-500'
              }
            >
              {results[name] === undefined
                ? testing
                  ? '检测中…'
                  : '未检测'
                : results[name] === null
                  ? '不可达'
                  : `${results[name]} ms`}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-foreground-500 mt-2">服务连通性</p>
      {editing && (
        <ProbeTargetsDialog
          title="流媒体 / AI 检测项目"
          targets={targets}
          selected={selected}
          onClose={() => setEditing(false)}
          onSave={(next, visible) => {
            localStorage.setItem('home-service-targets', JSON.stringify(next))
            localStorage.setItem('home-service-selected', JSON.stringify(visible))
            setTargets(next)
            setSelected(visible)
          }}
        />
      )}
    </section>
  )
}
