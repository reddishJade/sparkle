import { it } from 'node:test'
import assert from 'node:assert/strict'
import { TrafficStatsEngine } from '../src/main/traffic/traffic-stats-engine'

it('core session includes initial counters, survives client restart, and resets on core switch', () => {
  const engine = new TrafficStatsEngine()
  engine.feedSnapshot({ uploadTotal: 100, downloadTotal: 200 }, 1000, 'core-a')
  assert.equal(engine.getSummary('session').total, 300)
  engine.feedSnapshot({ uploadTotal: 150, downloadTotal: 300 }, 2000, 'core-a')
  const restored = new TrafficStatsEngine(structuredClone(engine.getRawData()))
  restored.feedSnapshot({ uploadTotal: 200, downloadTotal: 400 }, 3000, 'core-a')
  assert.equal(restored.getSummary('session').total, 600)
  restored.feedSnapshot({ uploadTotal: 250, downloadTotal: 500 }, 4000, 'core-b')
  assert.equal(restored.getSummary('session').total, 750)
  restored.feedSnapshot({ uploadTotal: 10, downloadTotal: 20 }, 5000, 'core-b')
  assert.equal(restored.getSummary('session').total, 30)
})

it('clearing a core session preserves the reset baseline after client restart', () => {
  const engine = new TrafficStatsEngine()
  engine.feedSnapshot({ uploadTotal: 100, downloadTotal: 200 }, 1000, 'core-a')
  engine.clear(2000)
  const restored = new TrafficStatsEngine(structuredClone(engine.getRawData()))
  restored.feedSnapshot({ uploadTotal: 110, downloadTotal: 220 }, 3000, 'core-a')
  assert.equal(restored.getSummary('session').total, 30)
})
