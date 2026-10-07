import { it } from 'node:test'
import assert from 'node:assert/strict'
import { calcTrafficTotal } from '../src/renderer/src/utils/calc'

it('traffic totals only use KB, MB and GB', () => {
  assert.equal(calcTrafficTotal(0), '0.00 KB')
  assert.equal(calcTrafficTotal(512), '0.50 KB')
  assert.equal(calcTrafficTotal(1024), '1.00 KB')
  assert.equal(calcTrafficTotal(1024 ** 2), '1.00 MB')
  assert.equal(calcTrafficTotal(1024 ** 3), '1.00 GB')
  assert.equal(calcTrafficTotal(1024 ** 4), '1024 GB')
})
