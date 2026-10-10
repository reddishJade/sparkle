import {
  streamingTargets,
  validateNetworkTargets,
  type NetworkTarget
} from '../../../../shared/network-targets'
export function readTargets(key: string, defaults: NetworkTarget[]): NetworkTarget[] {
  try {
    return validateNetworkTargets(JSON.parse(localStorage.getItem(key) ?? 'null'))
  } catch {
    return defaults
  }
}
export function readServiceTargets(): NetworkTarget[] {
  const saved = readTargets('home-service-targets', streamingTargets)
  const legacy = streamingTargets.slice(0, 5)
  // Upgrade the original stock catalog; keep user-edited catalogs intact.
  return saved.length === legacy.length &&
    saved.every(
      (target, index) =>
        target.name === legacy[index].name &&
        new URL(target.url).href === new URL(legacy[index].url).href
    )
    ? streamingTargets
    : saved
}
