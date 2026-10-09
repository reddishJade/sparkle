import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initializeLiveData, getConnectionArchive } from '../src/renderer/src/hooks/use-live-data'

test('stopping the core archives active connections once and clears their speeds', () => {
  const handlers = new Map<string, (...args: unknown[]) => void>()
  Object.assign(globalThis, {
    window: {
      electron: {
        ipcRenderer: {
          on: (name: string, handler: (...args: unknown[]) => void) => {
            handlers.set(name, handler)
            return () => handlers.delete(name)
          }
        }
      }
    }
  })
  initializeLiveData()
  handlers.get('mihomoConnections')!(null, {
    uploadTotal: 10,
    downloadTotal: 20,
    memory: 30,
    connections: [{ id: 'live-1', upload: 10, download: 20, metadata: {} }]
  })
  assert.equal(getConnectionArchive()[0].isActive, true)
  handlers.get('core-stopped')!()
  const archive = getConnectionArchive()
  assert.equal(archive.length, 1)
  assert.equal(archive[0].isActive, false)
  assert.equal(archive[0].uploadSpeed, 0)
  assert.equal(archive[0].downloadSpeed, 0)
  handlers.get('core-stopped')!()
  assert.equal(getConnectionArchive().length, 1)
  handlers.get('core-started')!()
  assert.equal(getConnectionArchive().filter((connection) => connection.isActive).length, 0)
})
