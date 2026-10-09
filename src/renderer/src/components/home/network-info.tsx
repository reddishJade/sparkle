// Network probes adapted from metacubexd; see licenses/metacubexd-MIT.txt.
import { getNetworkInfo, getNetworkLatencies } from '@renderer/utils/ipc'
import DashboardSelect from '@renderer/components/base/dashboard-select'
import { Button } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
const providers = {
  'ip.sb': 'https://api.ip.sb/geoip',
  'ipwho.is': 'https://ipwho.is/',
  'ipapi.is': 'https://api.ipapi.is/'
}
const targets = [
  { name: 'Google', url: 'https://www.google.com/generate_204' },
  { name: 'Cloudflare', url: 'https://cp.cloudflare.com/generate_204' },
  { name: 'GitHub', url: 'https://github.com' }
]
export default function NetworkInfo() {
  const [provider, setProvider] = useState<keyof typeof providers>('ip.sb')
  const [ip, setIp] = useState<{ address: string; location: string; org: string }>()
  const [ipError, setIpError] = useState('')
  const [loading, setLoading] = useState(false)
  const [latencies, setLatencies] = useState<Record<string, number | null>>({})
  const [testing, setTesting] = useState(false)
  const requestId = useRef(0)
  async function fetchIP(selected = provider): Promise<void> {
    const id = ++requestId.current
    setLoading(true)
    setIpError('')
    setIp(undefined)
    try {
      const result = await getNetworkInfo(selected)
      if (id === requestId.current) setIp(result)
    } catch (error) {
      if (id === requestId.current) setIpError(`查询失败：${String(error)}`)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }
  async function test(): Promise<void> {
    setTesting(true)
    try {
      setLatencies(await getNetworkLatencies())
    } catch {
      setLatencies(Object.fromEntries(targets.map((t) => [t.name, null])))
    }
    setTesting(false)
  }
  useEffect(() => {
    void fetchIP()
    void test()
    return () => {
      requestId.current++
    }
  }, [])
  return (
    <div className="dashboard-grid">
      <section className="dashboard-panel">
        <div className="flex items-center justify-between gap-2">
          <h2>出口 IP</h2>
          <div className="flex gap-2">
            <DashboardSelect
              label="IP 查询服务"
              className="w-28"
              value={provider}
              options={Object.keys(providers).map((name) => [name, name])}
              onChange={(value) => {
                const next = value as keyof typeof providers
                setProvider(next)
                void fetchIP(next)
              }}
            />
            <Button size="sm" variant="ghost" isDisabled={loading} onPress={() => void fetchIP()}>
              刷新
            </Button>
          </div>
        </div>
        <div className="text-xl font-semibold select-text my-3">
          {loading ? '正在查询…' : (ip?.address ?? '—')}
        </div>
        <p className="text-sm text-foreground-500">
          {ip?.location} {ip?.org}
        </p>
        {ipError && (
          <p role="alert" className="text-sm text-danger">
            {ipError}
          </p>
        )}
      </section>
      <section className="dashboard-panel">
        <div className="flex justify-between items-center">
          <h2>网络延迟</h2>
          <Button size="sm" variant="ghost" isDisabled={testing} onPress={() => void test()}>
            {testing ? '测试中…' : '测试全部'}
          </Button>
        </div>
        {targets.map((target) => (
          <div key={target.name} className="flex justify-between mt-3 text-sm">
            <span>{target.name}</span>
            <span className="text-foreground-500">
              {testing
                ? '测试中…'
                : latencies[target.name] === undefined
                  ? '—'
                  : latencies[target.name] === null
                    ? '连接失败 / 超时'
                    : `${latencies[target.name]} ms`}
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}
