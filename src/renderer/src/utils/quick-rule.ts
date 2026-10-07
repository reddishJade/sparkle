import { isIP } from 'is-ip'

export interface RuleCandidate {
  type: string
  value: string
}

function addressRules(address: string): RuleCandidate[] {
  if (!address) return []
  const ip = address.replace(/^\[|\]$/g, '')
  if (isIP(ip)) return [{ type: 'IP-CIDR', value: `${ip}/${ip.includes(':') ? 128 : 32}` }]
  if (!/^[a-z\d_-]+(?:\.[a-z\d_-]+)*\.?$/i.test(address)) return []
  return [
    { type: 'DOMAIN', value: address },
    { type: 'DOMAIN-SUFFIX', value: address }
  ]
}

export function connectionRuleCandidates(metadata: {
  host?: string
  sniffHost?: string
  destinationIP?: string
  process?: string
  processPath?: string
}): RuleCandidate[] {
  const candidates = [
    ...addressRules(metadata.host || metadata.sniffHost || ''),
    ...addressRules(metadata.destinationIP || ''),
    ...(metadata.process ? [{ type: 'PROCESS-NAME', value: metadata.process }] : []),
    ...(metadata.processPath ? [{ type: 'PROCESS-PATH', value: metadata.processPath }] : [])
  ]
  return candidates.filter(
    (item, index) =>
      candidates.findIndex((c) => c.type === item.type && c.value === item.value) === index
  )
}

export function logRuleCandidates(payload: string): RuleCandidate[] {
  // Only parse the destination of a connection log, never arbitrary IPs in errors.
  const match = payload.match(/-->\s+(\[[^\]]+\]|[^\s:]+):(\d+)(?=\s|$)/)
  return match ? addressRules(match[1]) : []
}

export function buildQuickRule(type: string, value: string, policy: string): string {
  value = value.trim()
  if (!value || /[,\r\n]/.test(value) || !policy || /[,\r\n]/.test(policy)) {
    throw new Error('规则内容和目标策略不能为空，也不能包含逗号或换行')
  }
  if (type === 'IP-CIDR') {
    const [ip, prefix, extra] = value.split('/')
    const max = ip.includes(':') ? 128 : 32
    if (!isIP(ip) || extra !== undefined || !/^\d+$/.test(prefix || '') || Number(prefix) > max) {
      throw new Error('请输入有效的 IP/CIDR 地址')
    }
  } else if (type === 'DOMAIN' || type === 'DOMAIN-SUFFIX') {
    if (!/^[a-z\d_-]+(?:\.[a-z\d_-]+)*\.?$/i.test(value) || isIP(value)) {
      throw new Error('请输入有效的域名，不要包含协议或端口')
    }
  } else if (type !== 'PROCESS-NAME' && type !== 'PROCESS-PATH') {
    throw new Error('不支持的规则类型')
  }
  return `${type},${value},${policy}${type === 'IP-CIDR' ? ',no-resolve' : ''}`
}
