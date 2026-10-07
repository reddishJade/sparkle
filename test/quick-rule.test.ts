import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildQuickRule,
  connectionRuleCandidates,
  logRuleCandidates
} from '../src/renderer/src/utils/quick-rule'

test('connection candidates prefer host and retain IP and process options', () => {
  assert.deepEqual(
    connectionRuleCandidates({
      host: 'example.com',
      destinationIP: '1.2.3.4',
      process: 'browser.exe',
      processPath: '/usr/bin/browser'
    }),
    [
      { type: 'DOMAIN', value: 'example.com' },
      { type: 'DOMAIN-SUFFIX', value: 'example.com' },
      { type: 'IP-CIDR', value: '1.2.3.4/32' },
      { type: 'PROCESS-NAME', value: 'browser.exe' },
      { type: 'PROCESS-PATH', value: '/usr/bin/browser' }
    ]
  )
  assert.deepEqual(connectionRuleCandidates({ sniffHost: 'example.com' })[0], {
    type: 'DOMAIN',
    value: 'example.com'
  })
  assert.equal(connectionRuleCandidates({ host: '1.2.3.4', destinationIP: '1.2.3.4' }).length, 1)
})

test('log parser extracts only connection destinations including IPv6', () => {
  assert.deepEqual(
    logRuleCandidates('[TCP] 127.0.0.1:1234 --> example.com:443 match Domain using Proxy'),
    [
      { type: 'DOMAIN', value: 'example.com' },
      { type: 'DOMAIN-SUFFIX', value: 'example.com' }
    ]
  )
  assert.deepEqual(logRuleCandidates('[UDP] 127.0.0.1:1234 --> 1.2.3.4:53 using DIRECT'), [
    { type: 'IP-CIDR', value: '1.2.3.4/32' }
  ])
  assert.deepEqual(logRuleCandidates('[TCP] [::1]:1234 --> [2001:db8::1]:443 using DIRECT'), [
    { type: 'IP-CIDR', value: '2001:db8::1/128' }
  ])
  assert.deepEqual(logRuleCandidates('DNS error from 1.2.3.4:53'), [])
  assert.deepEqual(logRuleCandidates('startup complete'), [])
})

test('build rules and reject invalid or injected fields', () => {
  assert.equal(buildQuickRule('DOMAIN', ' example.com ', 'Proxy'), 'DOMAIN,example.com,Proxy')
  assert.equal(
    buildQuickRule('IP-CIDR', '2001:db8::1/128', 'DIRECT'),
    'IP-CIDR,2001:db8::1/128,DIRECT,no-resolve'
  )
  assert.equal(
    buildQuickRule('PROCESS-PATH', '/Applications/My Browser', 'REJECT'),
    'PROCESS-PATH,/Applications/My Browser,REJECT'
  )
  for (const value of [
    '',
    'example.com,REJECT',
    'example.com\nMATCH',
    'https://example.com',
    '1.2.3.4'
  ]) {
    assert.throws(() => buildQuickRule('DOMAIN', value, 'DIRECT'))
  }
  for (const value of ['1.2.3.4', '1.2.3.4/33', '::1/129', '::1/-1', '1.2.3.4/24/1', 'bad/32']) {
    assert.throws(() => buildQuickRule('IP-CIDR', value, 'DIRECT'))
  }
  assert.throws(() => buildQuickRule('DOMAIN', 'example.com', 'Proxy,REJECT'))
  assert.throws(() => buildQuickRule('MATCH', 'example.com', 'DIRECT'))
})
