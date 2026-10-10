import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { streamingTargets, type NetworkTarget } from '../src/shared/network-targets'
import { readServiceTargets } from '../src/renderer/src/components/home/probe-preferences'

function loadSaved(targets: NetworkTarget[]): NetworkTarget[] {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => JSON.stringify(targets) }
  })
  try {
    return readServiceTargets()
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
}

describe('Service preset upgrades', () => {
  it('expands a saved legacy stock catalog, including normalized URLs', () => {
    const legacy = streamingTargets.slice(0, 5).map((target) => ({
      ...target,
      url: new URL(target.url).href
    }))
    assert.equal(loadSaved(legacy).length, streamingTargets.length)
  })
  it('preserves edited endpoints and user-created catalogs', () => {
    const edited = streamingTargets.slice(0, 5).map((target) => ({ ...target }))
    edited[0].url = 'https://example.com/custom'
    assert.equal(loadSaved(edited).length, 5)
    assert.equal(loadSaved(edited)[0].url, edited[0].url)
    const custom = [{ name: 'Custom', url: 'https://example.com/' }]
    assert.deepEqual(loadSaved(custom), custom)
  })
})
