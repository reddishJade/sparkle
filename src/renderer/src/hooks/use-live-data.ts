import { useSyncExternalStore } from 'react'

export interface LiveSample {
  time: number
  up: number
  down: number
  memory: number
  connections: number
}
interface LiveData {
  traffic: ControllerTraffic
  connections: ControllerConnections
  memory: number
  history: LiveSample[]
  connected: boolean
}
let state: LiveData = {
  traffic: { up: 0, down: 0 },
  connections: { uploadTotal: 0, downloadTotal: 0, memory: 0, connections: [] },
  memory: 0,
  history: [],
  connected: false
}
const listeners = new Set<() => void>()
let started = false
let previousTime = 0
let previous = new Map<string, ControllerConnectionDetail>()
let archived: ControllerConnectionDetail[] = []
function publish(next: Partial<LiveData>): void {
  state = { ...state, ...next }
  listeners.forEach((notify) => notify())
}
export function initializeLiveData(): void {
  if (started) return
  started = true
  window.electron.ipcRenderer.on('mihomoTraffic', (_event, traffic: ControllerTraffic) => {
    const time = Date.now()
    publish({
      traffic,
      history: [
        ...state.history,
        {
          time,
          ...traffic,
          memory: state.memory,
          connections: state.connections.connections?.length ?? 0
        }
      ].slice(-120)
    })
  })
  window.electron.ipcRenderer.on('mihomoMemory', (_event, memory: ControllerMemory) =>
    publish({ memory: memory.inuse })
  )
  window.electron.ipcRenderer.on('mihomoConnections', (_event, info: ControllerConnections) => {
    const now = Date.now()
    const seconds = previousTime ? Math.max((now - previousTime) / 1000, 0.001) : 1
    const connections = (info.connections ?? []).map((connection) => {
      const old = previous.get(connection.id)
      return {
        ...connection,
        isActive: true,
        uploadSpeed: old ? Math.max(0, connection.upload - old.upload) / seconds : 0,
        downloadSpeed: old ? Math.max(0, connection.download - old.download) / seconds : 0
      }
    })
    const activeIds = new Set(connections.map((connection) => connection.id))
    archived = [
      ...archived,
      ...[...previous.values()]
        .filter((connection) => !activeIds.has(connection.id))
        .map((connection) => ({ ...connection, isActive: false, uploadSpeed: 0, downloadSpeed: 0 }))
    ].slice(-1000)
    previous = new Map(connections.map((connection) => [connection.id, connection]))
    previousTime = now
    publish({
      connections: { ...info, connections },
      memory: info.memory ?? state.memory,
      connected: true
    })
  })
  window.electron.ipcRenderer.on('core-stopped', () =>
    publish({ connected: false, traffic: { up: 0, down: 0 } })
  )
  window.electron.ipcRenderer.on('core-started', () => {
    previous.clear()
    previousTime = 0
    publish({
      traffic: { up: 0, down: 0 },
      connections: { uploadTotal: 0, downloadTotal: 0, memory: 0, connections: [] },
      history: [],
      connected: false
    })
  })
}
export function useLiveData(): LiveData {
  return useSyncExternalStore(
    (notify) => {
      initializeLiveData()
      listeners.add(notify)
      return () => {
        listeners.delete(notify)
      }
    },
    () => state
  )
}

export function getConnectionArchive(): ControllerConnectionDetail[] {
  return [...archived, ...(state.connections.connections ?? [])]
}
