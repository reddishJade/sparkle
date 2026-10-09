// Adapted from MetaCubeX/metacubexd NetworkTopology.vue; see licenses/metacubexd-MIT.txt.
export type NodeType = 'root' | 'group' | 'proxy' | 'rule' | 'client' | 'port'
export interface TopologyNode {
  id: string
  name: string
  type: NodeType
  count: number
  traffic: number
  children: TopologyNode[]
}
export function buildTopology(connections: ControllerConnectionDetail[]): TopologyNode {
  const root: TopologyNode = {
    id: '[]',
    name: '连接',
    type: 'root',
    count: 0,
    traffic: 0,
    children: []
  }
  const nodes = new Map<string, TopologyNode>()
  for (const connection of connections) {
    const proxy = connection.chains?.[0] || 'DIRECT'
    const group = connection.chains?.[1] || proxy
    const parts: Array<[NodeType, string]> = [
      ['group', group],
      ['proxy', proxy],
      [
        'rule',
        connection.rulePayload
          ? `${connection.rule}: ${connection.rulePayload}`
          : connection.rule || 'Direct'
      ],
      ['client', connection.metadata.sourceIP || '未知设备'],
      ['port', String(connection.metadata.sourcePort || '未知端口')]
    ]
    const traffic = Math.max(0, connection.upload) + Math.max(0, connection.download)
    root.count++
    root.traffic += traffic
    let parent = root
    const path: string[] = []
    for (const [type, name] of parts) {
      path.push(name)
      const id = JSON.stringify(path)
      let node = nodes.get(id)
      if (!node) {
        node = { id, name, type, count: 0, traffic: 0, children: [] }
        nodes.set(id, node)
        parent.children.push(node)
      }
      node.count++
      node.traffic += traffic
      parent = node
    }
  }
  return root
}
