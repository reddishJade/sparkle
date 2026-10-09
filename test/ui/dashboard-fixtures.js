localStorage.setItem('tourShown', 'true')
const events = new Map()
window.__calls = []
const appConfig = {
  appTheme: 'light',
  useWindowFrame: true,
  siderWidth: 250,
  autoCheckUpdate: false,
  disableAnimation: true,
  proxyCols: 'auto',
  connectionMaxClosed: 1000,
  sysProxy: { enable: false, mode: 'manual', host: '127.0.0.1' },
  dns: {},
  siderOrder: [
    'sysproxy',
    'tun',
    'proxy',
    'connection',
    'traffic',
    'profile',
    'mihomo',
    'rule',
    'override',
    'log',
    'dns',
    'sniff'
  ]
}
const meta = {
  network: 'tcp',
  type: 'Mixed',
  sourceIP: '192.168.1.2',
  sourcePort: '52344',
  destinationIP: '93.184.216.34',
  destinationPort: '443',
  sourceGeoIP: [],
  destinationGeoIP: ['US'],
  sourceIPASN: '',
  destinationIPASN: 'AS15133',
  inboundIP: '127.0.0.1',
  inboundPort: '7890',
  inboundName: 'mixed',
  inboundUser: 'alice',
  host: 'example.com',
  dnsMode: 'normal',
  process: 'Firefox',
  processPath: '/usr/bin/firefox',
  remoteDestination: '',
  sniffHost: ''
}
let connections = [
  {
    id: 'a',
    metadata: meta,
    upload: 12000,
    download: 42000,
    start: new Date(Date.now() - 60000).toISOString(),
    chains: ['Tokyo', 'Auto', 'Proxy'],
    rule: 'DomainSuffix',
    rulePayload: 'example.com',
    isActive: true
  },
  {
    id: 'b',
    metadata: {
      ...meta,
      network: 'udp',
      sourceIP: '192.168.1.3',
      host: 'github.com',
      sourcePort: '54321'
    },
    upload: 32000,
    download: 89000,
    start: new Date().toISOString(),
    chains: ['Singapore', 'Proxy'],
    rule: 'Match',
    rulePayload: '',
    isActive: true
  }
]
const proxies = ['Tokyo', 'Singapore', 'Hong Kong'].map((name, i) => ({
  name,
  type: 'Shadowsocks',
  alive: true,
  udp: true,
  history: [{ time: new Date().toISOString(), delay: 40 + i * 20 }],
  extra: {},
  id: name,
  'provider-name': 'Airport'
}))
const groups = [
  {
    name: 'Proxy',
    type: 'Selector',
    all: proxies,
    now: 'Tokyo',
    history: [],
    extra: {},
    hidden: false
  },
  {
    name: 'Auto',
    type: 'URLTest',
    all: proxies,
    now: 'Singapore',
    history: [],
    extra: {},
    hidden: false
  }
]
let retention = 2592000000
window.api = { platform: 'linux', webUtils: {} }
window.electron = {
  ipcRenderer: {
    on: (name, handler) => {
      const set = events.get(name) || new Set()
      set.add(handler)
      events.set(name, set)
      return () => set.delete(handler)
    },
    removeAllListeners: (name) => events.delete(name),
    send: () => {},
    invoke: async (name, ...args) => {
      window.__calls.push([name, ...args])
      if (name === 'getAppConfig') return structuredClone(appConfig)
      if (name === 'patchAppConfig') return Object.assign(appConfig, args[0])
      if (name === 'getControledMihomoConfig' || name === 'mihomoConfig')
        return {
          mode: 'rule',
          tun: { enable: false },
          dns: { enable: true },
          'external-controller': '127.0.0.1:9090',
          'find-process-mode': 'always'
        }
      if (name === 'getProfileConfig') return { items: [], current: '' }
      if (name === 'getOverrideConfig') return { items: [] }
      if (name === 'mihomoGroups') return structuredClone(groups)
      if (name === 'mihomoRules')
        return {
          rules: [
            {
              index: 0,
              type: 'DomainSuffix',
              payload: 'example.com',
              proxy: 'Proxy',
              size: 1,
              extra: { hitCount: 5, disabled: false }
            },
            {
              index: 1,
              type: 'Match',
              payload: '',
              proxy: 'DIRECT',
              size: 1,
              extra: { hitCount: 3, disabled: false }
            }
          ]
        }
      if (name === 'mihomoVersion') return { version: '1.19.0', meta: true }
      if (name === 'getVersion') return '1.26.9'
      if (name === 'getNetworkInfo')
        return { address: '203.0.113.42', location: 'Singapore', org: 'Example ISP' }
      if (name === 'getNetworkLatencies')
        return Object.fromEntries(
          (args[0] ?? [{ name: 'Google' }, { name: 'Cloudflare' }, { name: 'GitHub' }]).map(
            (target, index) => [target.name, 53 + index * 10]
          )
        )
      if (name === 'getCachedMihomoLogs') return []
      if (name === 'getTrafficStats')
        return {
          totalUpload: 44000,
          totalDownload: 131000,
          total: 175000,
          nodes: [],
          groups: [],
          unknownTotal: 0
        }
      if (name === 'mihomoProxyProviders')
        return {
          providers: {
            Airport: {
              name: 'Airport',
              type: 'Proxy',
              vehicleType: 'HTTP',
              updatedAt: new Date().toISOString(),
              proxies: structuredClone(proxies),
              testUrl: 'https://www.google.com/generate_204',
              subscriptionInfo: {
                Upload: 4000000,
                Download: 16000000,
                Total: 107374182400,
                Expire: 1790000000
              }
            }
          }
        }
      if (name === 'mihomoRuleProviders')
        return {
          providers: {
            Geo: {
              name: 'Geo',
              ruleCount: 150,
              vehicleType: 'HTTP',
              behavior: 'domain',
              format: 'text',
              updatedAt: new Date().toISOString()
            }
          }
        }
      if (name === 'getRuntimeConfig')
        return {
          'proxy-providers': {
            Airport: { url: 'https://example.com/sub', path: 'proxies/airport.yaml' }
          },
          'rule-providers': { Geo: { url: 'https://example.com/rules' } }
        }
      if (name === 'mihomoChangeProxy') {
        groups.find((g) => g.name === args[0]).now = args[1]
        return {}
      }
      if (name === 'mihomoProxyDelay') return { delay: args[0] === 'Hong Kong' ? 25 : 50 }
      if (name === 'mihomoGroupDelay') return { Tokyo: 50, Singapore: 70, 'Hong Kong': 25 }
      if (name === 'getUsage') {
        const q = args[0]
        let labels = {
          sourceIP: ['192.168.1.2', '192.168.1.3'],
          inboundUser: ['alice', 'guest'],
          host: ['example.com', 'github.com'],
          outbound: ['Tokyo', 'Singapore'],
          process: ['Firefox', 'curl']
        }[q.dimension]
        return {
          entries: labels.map((label, i) => ({
            label,
            upload: 1000000 * (i + 1),
            download: 4000000 * (i + 1),
            total: 5000000 * (i + 1),
            count: 10 * (i + 1)
          })),
          trend: Array.from({ length: 12 }, (_, i) => ({
            time: (q.session ? Date.now() - 11 * 60000 : q.start) + i * 60000,
            upload: 200000 + i * 10000,
            download: 400000 + i * 20000
          })),
          totalUpload: 3000000,
          totalDownload: 12000000,
          count: 30,
          retention,
          startedAt: Date.now() - 86400000
        }
      }
      if (name === 'setUsageRetention') {
        retention = args[0]
        return {}
      }
      if (name === 'getCurrentProfileItem') return { name: 'Test', id: 'test' }
      if (name === 'getAppName') return 'Firefox'
      if (name === 'getIconDataURL') return ''
      if (name === 'findSystemMihomo') return []
      if (name === 'resolveThemes') return []
      if (name === 'checkAutoRun') return false
      if (name === 'mihomoCloseConnection') {
        connections = connections.filter((c) => c.id !== args[0])
        return {}
      }
      return {}
    }
  }
}
window.__emit = (name, data) => {
  ;(events.get(name) || []).forEach((handler) => handler({}, structuredClone(data)))
}
setInterval(() => {
  window.__emit('mihomoTraffic', { up: 12000, down: 45000 })
  window.__emit('mihomoMemory', { inuse: 48000000 })
  window.__emit('mihomoConnections', {
    connections,
    uploadTotal: 44000,
    downloadTotal: 131000,
    memory: 48000000
  })
}, 500)

window.__setTheme = (theme) => {
  appConfig.appTheme = theme
  window.__emit('appConfigUpdated', {})
}

// Representative volumes for layout review; functional tests keep the smaller fixture.
window.__setDenseFixtures = () => {
  const invoke = window.electron.ipcRenderer.invoke
  window.electron.ipcRenderer.invoke = async (name, ...args) => {
    const result = await invoke(name, ...args)
    if (name === 'mihomoRules') {
      const names = [
        'emby.yzt.lol',
        'cnemby.yzt.lol',
        'reject',
        'private',
        'direct',
        'connectivity',
        'ai@cn',
        'apple@cn',
        'microsoft@cn',
        'cdn',
        'domestic',
        'domestic@ip',
        'google',
        'telegram',
        'github',
        'netflix',
        'youtube',
        'spotify',
        'steam',
        'games',
        'proxy',
        'ads',
        'lan',
        'custom-long-domain-name.example.com',
        'final',
        'Match'
      ]
      const targets = ['DIRECT', 'REJECT', 'CDN', 'AI', 'USA', 'Proxy', 'Select', 'Google', 'Final']
      return {
        rules: names.map((payload, index) => ({
          index,
          payload,
          type: index < 2 ? 'Domain' : index === 25 ? 'Match' : 'RuleSet',
          proxy: targets[index % targets.length],
          size: 1,
          extra: {
            disabled: false,
            hitCount: index === 2 ? 3527 : index * 7,
            missCount: 7298 - index * 137,
            hitAt: new Date(Date.now() - 60000).toISOString(),
            missAt: new Date(Date.now() - 60000).toISOString()
          }
        }))
      }
    }
    if (name === 'mihomoProxyProviders') {
      return {
        providers: Object.fromEntries(
          [
            ['INIF', 5],
            ['Snow', 11]
          ].map(([name, count], i) => [
            name,
            {
              name,
              type: 'Proxy',
              vehicleType: 'HTTP',
              updatedAt: new Date(Date.now() - 360000).toISOString(),
              testUrl: 'https://www.google.com/generate_204',
              subscriptionInfo: {
                Upload: 4000000000,
                Download: i ? 126000000000 : 34000000000,
                Total: i ? 1099511627776 : 107374182400,
                Expire: 1795000000
              },
              proxies: Array.from({ length: count }, (_, index) => ({
                ...proxies[index % proxies.length],
                name:
                  ['HK香港', 'JP日本', 'SG新加坡', 'TW台湾', 'US美国'][index % 5] +
                  String(index + 1).padStart(2, '0'),
                type: i ? 'Vless' : 'AnyTLS',
                history: [
                  { time: new Date().toISOString(), delay: index % 4 === 1 ? 0 : 90 + index * 7 }
                ]
              }))
            }
          ])
        )
      }
    }
    return result
  }
  connections = Array.from({ length: 31 }, (_, index) => ({
    ...structuredClone(connections[index % 2]),
    id: 'dense-' + index,
    chains: [
      ['DIRECT', 'DIRECT'],
      ['usFrontier家宽', 'USA'],
      ['日本01', 'Proxy'],
      ['香港02', 'CDN']
    ][index % 4],
    rule: 'RuleSet',
    rulePayload: [
      'domestic',
      'connectivity',
      'domestic@ip',
      'ai',
      'google',
      'proxy',
      'streaming',
      'Match'
    ][index % 8]
  }))
}
