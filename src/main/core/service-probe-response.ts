import type { ServiceProbeResult } from '../../shared/network-targets'

// HTTP reachability is separate from subscription/catalog unlock.
export function classifyServiceResponse(
  status: number,
  body: string,
  challengeHeader?: string
): ServiceProbeResult['status'] {
  if (
    challengeHeader === 'challenge' ||
    /cf-chl-|\/cdn-cgi\/challenge-platform\/|verify you are human|just a moment\.\.\./i.test(body)
  )
    return 'challenge'
  if (
    /unsupported_country|not available in your (?:country|region)|not supported in your (?:country|region)|isn't supported in your country|unavailable in your country/i.test(
      body
    )
  )
    return 'restricted'
  if (status >= 200 && status < 400) return 'reachable'
  return status === 401 || status === 403 || status === 451 ? 'restricted' : 'failed'
}
