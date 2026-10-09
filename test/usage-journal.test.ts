import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { UsageJournal } from '../src/main/traffic/usage-journal'
const time = Date.parse('2026-10-09T00:00:00Z')
const connection = (
  id: string,
  upload: number,
  download: number,
  device = '192.168.1.2',
  host = 'example.com',
  node = 'Proxy'
) =>
  ({
    id,
    upload,
    download,
    chains: [node, 'Group'],
    metadata: { sourceIP: device, inboundUser: 'alice', host, process: 'browser' }
  }) as ControllerConnectionDetail
const snapshot = (...connections: ControllerConnectionDetail[]): ControllerConnections => ({
  connections,
  uploadTotal: 0,
  downloadTotal: 0,
  memory: 0
})
const query = (
  journal: UsageJournal,
  dimension: 'sourceIP' | 'host' | 'outbound' | 'process' | 'inboundUser' = 'sourceIP',
  filters?: Record<string, string>
) => journal.query({ start: time - 60000, end: time + 600000, dimension, filters })
describe('Usage journal', () => {
  it('counts deltas once, including new connections after an idle period', () => {
    const journal = new UsageJournal()
    journal.feed(snapshot(connection('a', 100, 200)), time, 'core-1')
    journal.feed(snapshot(connection('a', 150, 300)), time + 1000, 'core-1')
    journal.feed(snapshot(connection('a', 150, 300)), time + 2000, 'core-1')
    assert.equal(query(journal).totalUpload, 50)
    assert.equal(query(journal).totalDownload, 100)
    journal.feed(snapshot(), time + 3000, 'core-1')
    journal.feed(snapshot(connection('b', 20, 30)), time + 4000, 'core-1')
    assert.equal(query(journal).totalUpload, 70)
    assert.equal(query(journal).count, 2)
  })
  it('does not recount a temporarily missing connection', () => {
    const journal = new UsageJournal()
    journal.feed(snapshot(connection('a', 100, 200)), time, 'one')
    journal.feed(snapshot(connection('a', 110, 220)), time + 1000, 'one')
    journal.feed(snapshot(), time + 2000, 'one')
    journal.feed(snapshot(connection('a', 120, 240)), time + 3000, 'one')
    assert.equal(query(journal).totalUpload, 20)
    assert.equal(query(journal).totalDownload, 40)
  })
  it('restores persisted baselines without recounting and resets them for a new core', () => {
    const first = new UsageJournal()
    first.feed(snapshot(), time, 'one')
    first.feed(snapshot(connection('a', 10, 20)), time + 1000, 'one')
    const restored = new UsageJournal(JSON.parse(JSON.stringify(first.serialize())))
    restored.feed(snapshot(connection('a', 15, 25)), time + 2000, 'one')
    assert.equal(query(restored).totalUpload, 15)
    restored.feed(snapshot(connection('a', 100, 200)), time + 3000, 'two')
    restored.feed(snapshot(connection('a', 105, 210)), time + 4000, 'two')
    assert.equal(query(restored).totalUpload, 20)
    assert.equal(query(restored).totalDownload, 35)
  })
  it('supports all dimensions, distinct connection counts and combined drill-down filters', () => {
    const journal = new UsageJournal()
    journal.feed(snapshot(), time, 'one')
    journal.feed(
      snapshot(
        connection('a', 10, 20),
        connection('b', 30, 40, '192.168.1.3'),
        connection('c', 50, 60, '192.168.1.2', 'other.com', 'DIRECT')
      ),
      time + 1000,
      'one'
    )
    journal.feed(
      snapshot(
        connection('a', 20, 30),
        connection('b', 40, 50, '192.168.1.3'),
        connection('c', 60, 70, '192.168.1.2', 'other.com', 'DIRECT')
      ),
      time + 61000,
      'one'
    )
    for (const dimension of ['sourceIP', 'host', 'outbound', 'process', 'inboundUser'] as const)
      assert.equal(query(journal, dimension).totalUpload, 120)
    const drill = query(journal, 'outbound', { sourceIP: '192.168.1.2', host: 'example.com' })
    assert.deepEqual(drill.entries, [
      { label: 'Proxy', upload: 20, download: 30, total: 50, count: 1 }
    ])
    assert.equal(
      query(journal, 'sourceIP').entries.find((e) => e.label === '192.168.1.2')?.count,
      2
    )
    assert.equal(
      query(journal).trend.reduce((n, p) => n + p.download, 0),
      150
    )
  })
  it('clears records while keeping live baselines, applies retention, and rejects invalid queries', () => {
    const journal = new UsageJournal()
    journal.feed(snapshot(), time, 'one')
    journal.feed(snapshot(connection('a', 10, 20)), time + 1000, 'one')
    journal.clear(time + 2000)
    journal.feed(snapshot(connection('a', 15, 30)), time + 3000, 'one')
    assert.equal(query(journal).totalUpload, 5)
    assert.throws(() => journal.query({ start: 10, end: 0, dimension: 'sourceIP' }))
    assert.throws(() => journal.setRetention(123))
    journal.setRetention(3600000, time + 7200000)
    assert.equal(query(journal).entries.length, 0)
  })
})

it('keeps current-run usage separate across core restarts within the same minute', () => {
  const journal = new UsageJournal()
  journal.feed(snapshot(), time, 'first')
  journal.feed(snapshot(connection('same-id', 10, 20)), time + 1000, 'first')
  journal.feed(snapshot(), time + 2000, 'second')
  journal.feed(snapshot(connection('same-id', 30, 40)), time + 3000, 'second')
  const request = {
    start: time - 60000,
    end: time + 60000,
    dimension: 'sourceIP' as const,
    session: true
  }
  assert.equal(journal.query(request).totalUpload, 30)
  assert.equal(journal.query(request).totalDownload, 40)
  assert.equal(query(journal).totalUpload, 40)
  const restored = new UsageJournal(JSON.parse(JSON.stringify(journal.serialize())))
  assert.equal(restored.query(request).totalUpload, 30)
  restored.feed(snapshot(connection('same-id', 35, 45)), time + 4000, 'second')
  assert.equal(restored.query(request).totalUpload, 35)
})
