// Network probes adapted from metacubexd; see licenses/metacubexd-MIT.txt.
import { getNetworkInfo } from '@renderer/utils/ipc'
import DashboardSelect from '@renderer/components/base/dashboard-select'
import { FiRefreshCw } from 'react-icons/fi'
import { Button } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
const providers = {
  'ip.sb': 'https://api.ip.sb/geoip',
  'ipwho.is': 'https://ipwho.is/',
  'ipapi.is': 'https://api.ipapi.is/'
}
export default function NetworkInfo() {
  const [provider, setProvider] = useState<keyof typeof providers>('ip.sb')
  const [ip, setIp] = useState<{ address: string; location: string; org: string }>()
  const [ipError, setIpError] = useState('')
  const [loading, setLoading] = useState(false)
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
  useEffect(() => {
    void fetchIP()
    return () => {
      requestId.current++
    }
  }, [])
  return (
    <section className="dashboard-panel home-unit">
      <div className="home-unit-heading">
        <h2>出口 IP</h2>
        <Button
          size="sm"
          isIconOnly
          aria-label="刷新出口 IP"
          variant="ghost"
          isDisabled={loading}
          onPress={() => void fetchIP()}
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>
      <div className="home-unit-body">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <DashboardSelect
              label="IP 查询服务"
              className="w-full"
              value={provider}
              options={Object.keys(providers).map((name) => [name, name])}
              onChange={(value) => {
                const next = value as keyof typeof providers
                setProvider(next)
                void fetchIP(next)
              }}
            />
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
      </div>
    </section>
  )
}
