// Service requests follow the running configuration's rules through Mihomo's HTTP listener.
import { Button } from '@heroui/react'
import { useEffect, useState } from 'react'
import { FiPlay, FiSettings } from 'react-icons/fi'
import { streamingTargets } from '../../../../shared/network-targets'
import { getNetworkLatencies } from '@renderer/utils/ipc'
import ProbeTargetsDialog from './probe-targets-dialog'
import { readTargets } from './probe-preferences'
export default function ServiceReachability() {
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
  const [results, setResults] = useState<Record<string, number | null>>({})
  const [testing, setTesting] = useState(false)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    setResults({})
  }, [targets, selected])
  async function test(): Promise<void> {
    setTesting(true)
    setResults({})
    const visibleTargets = targets.filter((target) => selected.includes(target.name))
    try {
      setResults(await getNetworkLatencies(visibleTargets))
    } catch {
      setResults(Object.fromEntries(visibleTargets.map((target) => [target.name, null])))
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
            isDisabled={testing}
            onPress={() => void test()}
          >
            <FiPlay />
          </Button>
        </div>
      </div>
      <div className="home-unit-body">
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
      <p className="text-xs text-foreground-500 mt-2">按当前规则检测</p>
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
