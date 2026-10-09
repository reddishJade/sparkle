// Probe presets and reachability semantics adapted from metacubexd.
export interface NetworkTarget {
  name: string
  url: string
}
export interface NetworkIPInfo {
  address: string
  country?: string
  city?: string
  org?: string
  asn?: number
  isp?: string
  isProxy?: boolean
  isVPN?: boolean
}
export const latencyTargets: NetworkTarget[] = [
  { name: 'Google', url: 'https://www.google.com/generate_204' },
  { name: 'Cloudflare', url: 'https://cp.cloudflare.com/generate_204' },
  { name: 'GitHub', url: 'https://github.com' }
]
export const streamingTargets: NetworkTarget[] = [
  { name: 'YouTube', url: 'https://www.youtube.com/generate_204' },
  { name: 'Netflix', url: 'https://www.netflix.com' },
  { name: 'Disney+', url: 'https://www.disneyplus.com' },
  { name: 'OpenAI', url: 'https://chat.openai.com' },
  { name: 'Gemini', url: 'https://gemini.google.com' }
]
export function validateNetworkTargets(value: unknown): NetworkTarget[] {
  if (!Array.isArray(value) || !value.length || value.length > 64)
    throw new Error('请配置 1 至 64 个测试网址')
  const names = new Set<string>()
  return value.map((target) => {
    if (!target || typeof target.name !== 'string' || typeof target.url !== 'string')
      throw new Error('测试名称和网址不能为空')
    const name = target.name.trim()
    if (!name || name.length > 128 || names.has(name))
      throw new Error('测试名称不能为空或重复，且不能超过 128 个字符')
    let url: URL
    try {
      url = new URL(target.url.trim())
    } catch {
      throw new Error('请输入完整的 HTTP 或 HTTPS 网址')
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('测试网址须使用 HTTP 或 HTTPS，且不能包含登录信息')
    names.add(name)
    return { name, url: url.href }
  })
}
