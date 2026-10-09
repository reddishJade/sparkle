import { net } from 'electron'
import { performance } from 'node:perf_hooks'
// Fixed provider list follows metacubexd. Requests use Electron's network stack and OS proxy.
const providers = {
  'ip.sb': 'https://api.ip.sb/geoip',
  'ipwho.is': 'https://ipwho.is/',
  'ipapi.is': 'https://api.ipapi.is/'
}
export async function getNetworkInfo(
  provider: keyof typeof providers
): Promise<{ address: string; location: string; org: string }> {
  if (!Object.hasOwn(providers, provider)) throw new Error('未知 IP 查询服务')
  const response = await net.fetch(providers[provider], {
    signal: AbortSignal.timeout(10000),
    cache: 'no-store'
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (!data.ip || data.success === false) throw new Error(data.message || '未返回 IP 信息')
  return {
    address: data.ip,
    location: [data.country ?? data.location?.country, data.city ?? data.location?.city]
      .filter(Boolean)
      .join(' · '),
    org: data.asn_organization ?? data.connection?.org ?? data.asn?.org ?? ''
  }
}
export async function getNetworkLatencies(): Promise<Record<string, number | null>> {
  const targets = [
    ['Google', 'https://www.google.com/generate_204'],
    ['Cloudflare', 'https://cp.cloudflare.com/generate_204'],
    ['GitHub', 'https://github.com']
  ]
  return Object.fromEntries(
    await Promise.all(
      targets.map(async ([name, url]) => {
        const start = performance.now()
        try {
          const response = await net.fetch(url, {
            method: 'HEAD',
            cache: 'no-store',
            signal: AbortSignal.timeout(5000)
          })
          if (!response.ok) return [name, null]
          return [name, Math.round(performance.now() - start)]
        } catch {
          return [name, null]
        }
      })
    )
  )
}
