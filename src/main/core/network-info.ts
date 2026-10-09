import {
  latencyTargets,
  validateNetworkTargets,
  type NetworkIPInfo,
  type NetworkTarget
} from '../../shared/network-targets'
import axios, { type AxiosInstance } from 'axios'
import { mihomoConfig } from './mihomoApi'
import { performance } from 'node:perf_hooks'
// Every probe enters the running core's HTTP listener and follows its active rules/mode.
async function getProbeClient(): Promise<AxiosInstance> {
  const config = await mihomoConfig()
  const port = config['mixed-port'] || config.port
  if (!port) throw new Error('当前内核未启用 HTTP 或混合端口')
  const credential = config.authentication?.[0]
  const separator = credential?.indexOf(':') ?? -1
  return axios.create({
    proxy: {
      protocol: 'http',
      host: '127.0.0.1',
      port,
      ...(credential && separator >= 0
        ? {
            auth: {
              username: credential.slice(0, separator),
              password: credential.slice(separator + 1)
            }
          }
        : {})
    },
    timeout: 5000,
    headers: { 'Cache-Control': 'no-cache' }
  })
}
const providers = {
  'ip.sb': 'https://api.ip.sb/geoip',
  'ipwho.is': 'https://ipwho.is/',
  'ipapi.is': 'https://api.ipapi.is/'
}
export async function getNetworkInfo(provider: keyof typeof providers): Promise<NetworkIPInfo> {
  if (!Object.hasOwn(providers, provider)) throw new Error('未知 IP 查询服务')
  const client = await getProbeClient()
  const { data } = await client.get(providers[provider], { timeout: 10000 })
  if (!data.ip || data.success === false) throw new Error(data.message || '未返回 IP 信息')
  return {
    address: data.ip,
    country: data.country ?? data.location?.country,
    city: data.city ?? data.location?.city,
    org: data.asn_organization ?? data.connection?.org ?? data.asn?.org,
    asn: typeof data.asn === 'number' ? data.asn : (data.connection?.asn ?? data.asn?.asn),
    isp: data.connection?.isp,
    isProxy: data.is_proxy,
    isVPN: data.is_vpn
  }
}
export async function getNetworkLatencies(
  input: NetworkTarget[] = latencyTargets
): Promise<Record<string, number | null>> {
  const targets = validateNetworkTargets(input)
  const client = await getProbeClient()
  return Object.fromEntries(
    await Promise.all(
      targets.map(async ({ name, url }) => {
        const start = performance.now()
        try {
          await client.head(url)
          return [name, Math.round(performance.now() - start)]
        } catch {
          return [name, null]
        }
      })
    )
  )
}
