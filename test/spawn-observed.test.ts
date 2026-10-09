import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { spawnObserved } from '../src/main/utils/spawn-observed'

test(
  'a denied executable rejects startup instead of causing an uncaught process error',
  { skip: process.platform === 'win32' },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sparkle-denied-spawn-'))
    try {
      const executable = join(dir, 'monitor')
      await writeFile(executable, '#!/bin/sh\nexit 0\n', { mode: 0o600 })
      const errors: Error[] = []
      await assert.rejects(
        spawnObserved(executable, [], {}, (error) => errors.push(error)),
        { code: 'EACCES' }
      )
      assert.equal(errors.length, 1)
    } finally {
      await rm(dir, { recursive: true })
    }
  }
)

test('successful startup returns the live process and retains error observation', async () => {
  const errors: Error[] = []
  const child = await spawnObserved(
    process.execPath,
    ['-e', 'setTimeout(() => {}, 10000)'],
    {},
    (error) => errors.push(error)
  )
  try {
    assert.ok(child.pid)
    const error = new Error('later process operation failed')
    child.emit('error', error)
    assert.deepEqual(errors, [error])
  } finally {
    const exited = once(child, 'exit')
    child.kill()
    await exited
  }
})
