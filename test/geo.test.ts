import { it } from 'node:test'
import assert from 'node:assert/strict'
import { defaultGeoxUrl, migrateGeoxUrl } from '../src/shared/geo'

it('migrates all former Meta defaults to Bett without mutating the saved URLs', () => {
  const legacy = Object.fromEntries(
    Object.entries(defaultGeoxUrl).map(([key, url]) => [
      key,
      url.replace('appshubcc/bett-rules', 'MetaCubeX/meta-rules-dat')
    ])
  )
  const original = { ...legacy }
  assert.deepEqual(migrateGeoxUrl(legacy), defaultGeoxUrl)
  assert.deepEqual(legacy, original)
})

it('preserves custom URLs and only migrates matching entries in partial configurations', () => {
  const urls = {
    geoip: 'https://example.com/geoip.dat',
    geosite: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat'
  }
  assert.deepEqual(migrateGeoxUrl(urls), {
    geoip: urls.geoip,
    geosite: defaultGeoxUrl.geosite
  })
})

it('does not patch absent, empty, custom or already migrated configurations', () => {
  for (const urls of [undefined, {}, { mmdb: 'https://example.com/custom.mmdb' }, defaultGeoxUrl]) {
    assert.equal(migrateGeoxUrl(urls), undefined)
  }
})
