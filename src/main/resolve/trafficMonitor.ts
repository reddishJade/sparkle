import { ChildProcess } from 'child_process'
import { getAppConfig } from '../config'
import { dataDir, resourcesFilesDir } from '../utils/dirs'
import path from 'path'
import { existsSync } from 'fs'
import { readFile, rm, writeFile } from 'fs/promises'
import { spawnObserved } from '../utils/spawn-observed'
import { appendAppLog } from '../utils/log'

let child: ChildProcess | undefined

export async function startMonitor(detached = false): Promise<void> {
  if (process.platform !== 'win32') return
  if (existsSync(path.join(dataDir(), 'monitor.pid'))) {
    const pid = parseInt(await readFile(path.join(dataDir(), 'monitor.pid'), 'utf-8'))
    try {
      process.kill(pid, 'SIGINT')
    } catch {
      // ignore
    } finally {
      await rm(path.join(dataDir(), 'monitor.pid'))
    }
  }
  await stopMonitor()
  const { showTraffic = false } = await getAppConfig()
  if (!showTraffic) return
  const monitor = await spawnObserved(
    path.join(resourcesFilesDir(), 'TrafficMonitor/TrafficMonitor.exe'),
    [],
    {
      cwd: path.join(resourcesFilesDir(), 'TrafficMonitor'),
      detached: detached,
      stdio: detached ? 'ignore' : undefined
    },
    (error) => {
      appendAppLog(`[TrafficMonitor]: process error: ${error}\n`).catch(() => {})
    }
  )
  child = monitor
  monitor.once('exit', () => {
    if (child === monitor) child = undefined
  })
  if (detached) {
    if (child && child.pid) {
      await writeFile(path.join(dataDir(), 'monitor.pid'), child.pid.toString())
    }
    child.unref()
  }
}

async function stopMonitor(): Promise<void> {
  if (child) {
    child.kill('SIGINT')
    child = undefined
  }
}
