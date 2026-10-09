import { Button } from '@heroui/react'
import { useEffect, useState } from 'react'
import { FiRefreshCw, FiSettings } from 'react-icons/fi'
import { latencyTargets } from '../../../../shared/network-targets'
import { getNetworkLatencies } from '@renderer/utils/ipc'
import ProbeTargetsDialog from './probe-targets-dialog'
import { readTargets } from './probe-preferences'
export default function NetworkLatency() {
  const [targets, setTargets] = useState(() => readTargets('home-latency-targets', latencyTargets))
  const [results, setResults] = useState<Record<string, number | null>>({})
  const [testing, setTesting] = useState(false)
  const [editing, setEditing] = useState(false)
  async function test(): Promise<void> {
    setTesting(true)
    try {
      setResults(await getNetworkLatencies(targets))
    } catch {
      setResults(Object.fromEntries(targets.map((target) => [target.name, null])))
    } finally {
      setTesting(false)
    }
  }
  useEffect(() => {
    void test()
  }, [targets])
  return (
    <section className="dashboard-panel home-unit">
      <div className="home-unit-heading">
        <h2>网络延迟</h2>
        <div className="flex gap-1">
          <Button
            size="sm"
            isIconOnly
            aria-label="配置网络延迟网址"
            variant="ghost"
            isDisabled={testing}
            onPress={() => setEditing(true)}
          >
            <FiSettings />
          </Button>
          <Button
            size="sm"
            isIconOnly
            aria-label="测试网络延迟"
            variant="ghost"
            isDisabled={testing}
            onPress={() => void test()}
          >
            <FiRefreshCw className={testing ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>
      <div className="home-unit-body">
        {targets.map((target) => (
          <div key={target.name} className="home-unit-row">
            <span className="truncate">{target.name}</span>
            <span className={results[target.name] === null ? 'text-danger' : 'text-foreground-500'}>
              {testing
                ? '测试中…'
                : results[target.name] === undefined
                  ? '未测试'
                  : results[target.name] === null
                    ? '超时'
                    : `${results[target.name]} ms`}
            </span>
          </div>
        ))}
      </div>
      {editing && (
        <ProbeTargetsDialog
          title="网络延迟测试网址"
          targets={targets}
          onClose={() => setEditing(false)}
          onSave={(next) => {
            localStorage.setItem('home-latency-targets', JSON.stringify(next))
            setResults({})
            setTargets(next)
          }}
        />
      )}
    </section>
  )
}
