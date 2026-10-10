import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyServiceResponse } from '../src/main/core/service-probe-response'

describe('Service probe responses', () => {
  it('separates a successful HTTP response from explicit region denial', () => {
    assert.equal(classifyServiceResponse(200, 'Welcome'), 'reachable')
    assert.equal(
      classifyServiceResponse(200, 'This service is not available in your country'),
      'restricted'
    )
    assert.equal(classifyServiceResponse(403, '{"code":"unsupported_country"}'), 'restricted')
  })
  it('does not mistake bot verification pages for reachability or region denial', () => {
    assert.equal(classifyServiceResponse(200, '<title>Just a moment...</title>'), 'challenge')
    assert.equal(classifyServiceResponse(403, '', 'challenge'), 'challenge')
    assert.equal(classifyServiceResponse(503, 'maintenance'), 'failed')
  })
})
