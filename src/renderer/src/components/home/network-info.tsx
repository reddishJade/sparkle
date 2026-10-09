// Network probes adapted from metacubexd; see licenses/metacubexd-MIT.txt.
import { getNetworkInfo } from '@renderer/utils/ipc'
import DashboardSelect from '@renderer/components/base/dashboard-select'
import { FiRefreshCw } from 'react-icons/fi'
import { Button } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import type { NetworkIPInfo } from '../../../../shared/network-targets'
const providers = {
  'ip.sb': 'https://api.ip.sb/geoip',
  'ipwho.is': 'https://ipwho.is/',
  'ipapi.is': 'https://api.ipapi.is/'
}
export default function NetworkInfo() {
  const [provider, setProvider] = useState<keyof typeof providers>('ip.sb')
  const [ip, setIp] = useState<NetworkIPInfo>()
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
        <DashboardSelect
          label="IP 查询服务"
          className="ip-provider"
          value={provider}
          options={Object.keys(providers).map((name) => [name, name])}
          onChange={(value) => {
            const next = value as keyof typeof providers
            setProvider(next)
            void fetchIP(next)
          }}
        />
        <div className="home-unit-row ip-address">
          <span>IP</span>
          <span className="select-text">{loading ? '正在查询…' : (ip?.address ?? '—')}</span>
        </div>
        {ip &&
          [
            ['国家', ip.country],
            ['城市', ip.city],
            ['组织', ip.org],
            ['ASN', ip.asn ? `AS${ip.asn}` : undefined],
            ['ISP', ip.isp]
          ].map(([label, value]) =>
            value ? (
              <div className="home-unit-row ip-detail" key={label}>
                <span>{label}</span>
                <span className="truncate select-text">{value}</span>
              </div>
            ) : null
          )}
        {ip && (ip.isProxy !== undefined || ip.isVPN !== undefined) && (
          <div className="home-unit-row ip-detail">
            <span>代理检测</span>
            <span>
              {[ip.isProxy && 'Proxy', ip.isVPN && 'VPN'].filter(Boolean).join(' · ') || '纯净'}
            </span>
          </div>
        )}
        {ipError && (
          <p role="alert" className="text-sm text-danger">
            {ipError}
          </p>
        )}
      </div>
    </section>
  )
}
