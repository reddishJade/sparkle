import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'

// spawn() reports launch failures asynchronously; observe them before returning the child.
export function spawnObserved(
  command: string,
  args: string[],
  options: SpawnOptions,
  onError: (error: Error) => void
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options)
    child.once('spawn', () => resolve(child))
    // Retain the listener to also handle errors from later kill/send operations.
    child.on('error', (error) => {
      onError(error)
      reject(error)
    })
  })
}
