import { validateNetworkTargets, type NetworkTarget } from '../../../../shared/network-targets'
export function readTargets(key: string, defaults: NetworkTarget[]): NetworkTarget[] {
  try {
    return validateNetworkTargets(JSON.parse(localStorage.getItem(key) ?? 'null'))
  } catch {
    return defaults
  }
}
