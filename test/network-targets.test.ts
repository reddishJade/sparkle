import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateNetworkTargets, streamingTargets } from '../src/shared/network-targets'
describe('Network probe targets', () => {
  it('accepts custom HTTP/HTTPS endpoints and normalizes names', () => {
    assert.deepEqual(validateNetworkTargets([{ name: ' Local ', url: 'http://127.0.0.1:18081' }]), [
      { name: 'Local', url: 'http://127.0.0.1:18081/' }
    ])
    assert.equal(validateNetworkTargets(streamingTargets).length, 5)
  })
  it('rejects non-network URLs, credentials, duplicate names and oversized lists', () => {
    for (const url of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'https://user:password@example.com',
      'invalid'
    ])
      assert.throws(() => validateNetworkTargets([{ name: 'bad', url }]))
    assert.throws(() =>
      validateNetworkTargets([
        { name: 'same', url: 'https://example.com' },
        { name: ' same ', url: 'https://example.org' }
      ])
    )
    assert.throws(() => validateNetworkTargets([]))
    assert.throws(() =>
      validateNetworkTargets(
        Array.from({ length: 65 }, (_, i) => ({ name: String(i), url: 'https://example.com' }))
      )
    )
  })
})
