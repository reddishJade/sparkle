// Probe presets and reachability semantics adapted from metacubexd.
export interface NetworkTarget {
  name: string
  url: string
}
export interface ServiceProbeResult {
  status: 'reachable' | 'restricted' | 'challenge' | 'failed'
  latency: number | null
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
  { name: 'Gemini', url: 'https://gemini.google.com' },
  { name: 'Claude', url: 'https://claude.ai' },
  { name: 'Grok', url: 'https://grok.com' },
  { name: 'OpenRouter', url: 'https://openrouter.ai' },
  { name: 'Poe', url: 'https://poe.com' },
  { name: 'Suno', url: 'https://suno.com' },
  { name: 'Perplexity', url: 'https://www.perplexity.ai' },
  { name: 'YouTube Music', url: 'https://music.youtube.com' },
  { name: 'Spotify', url: 'https://open.spotify.com' },
  { name: 'TikTok', url: 'https://www.tiktok.com' },
  { name: 'Crunchyroll', url: 'https://www.crunchyroll.com' },
  { name: 'Bilibili', url: 'https://www.bilibili.com' },
  { name: '爱奇艺', url: 'https://www.iqiyi.com' },
  { name: '腾讯视频', url: 'https://v.qq.com' },
  { name: '网易云音乐', url: 'https://music.163.com' },
  { name: '抖音', url: 'https://www.douyin.com' },
  { name: 'myTV SUPER', url: 'https://www.mytvsuper.com' },
  { name: 'ViuTV', url: 'https://viu.tv' },
  { name: 'HOY TV', url: 'https://hoy.tv' },
  { name: 'RTHK', url: 'https://www.rthk.hk' },
  { name: 'Reddit', url: 'https://www.reddit.com' },
  { name: 'X', url: 'https://x.com' },
  { name: 'Discord', url: 'https://discord.com' },
  { name: 'Telegram', url: 'https://web.telegram.org' },
  { name: 'V2EX', url: 'https://www.v2ex.com' },
  { name: 'Medium', url: 'https://medium.com' },
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'Steam', url: 'https://store.steampowered.com' },
  { name: 'Epic Games', url: 'https://store.epicgames.com' }
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
