import { it } from 'node:test'
import assert from 'node:assert/strict'
import { buildTopology } from '../src/renderer/src/components/home/topology-data'
it('groups actual connections by group, proxy, full rule, source address and port', () => {
  const connections = ['443', '80'].map((port, i) => ({
    id: String(i),
    chains: ['Node', 'Group'],
    rule: 'Domain',
    rulePayload: 'example.com',
    upload: 10,
    download: 20,
    metadata: { sourceIP: '192.168.1.2', sourcePort: port }
  })) as ControllerConnectionDetail[]
  const tree = buildTopology(connections)
  assert.equal(tree.count, 2)
  assert.equal(tree.traffic, 60)
  const group = tree.children[0],
    proxy = group.children[0],
    rule = proxy.children[0],
    client = rule.children[0]
  assert.equal(group.name, 'Group')
  assert.equal(proxy.name, 'Node')
  assert.equal(rule.name, 'Domain: example.com')
  assert.equal(client.count, 2)
  assert.deepEqual(
    client.children.map((node) => node.name),
    ['443', '80']
  )
})
it('keeps identical names in different branches separate and handles direct connections', () => {
  const tree = buildTopology([
    {
      chains: ['a-b', 'c'],
      rule: 'Match',
      metadata: { sourceIP: 'x', sourcePort: '1' },
      upload: 1,
      download: 2
    },
    {
      chains: ['a', 'b-c'],
      rule: 'Match',
      metadata: { sourceIP: 'x', sourcePort: '1' },
      upload: 1,
      download: 2
    },
    { chains: [], rule: 'Match', metadata: {}, upload: 1, download: 2 }
  ] as ControllerConnectionDetail[])
  assert.equal(tree.children.length, 3)
  assert.equal(new Set(tree.children.map((group) => group.children[0].id)).size, 3)
  assert.equal(tree.children[2].name, 'DIRECT')
})
