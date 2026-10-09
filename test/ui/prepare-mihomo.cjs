// Generate an isolated real-core integration fixture; never read a user's Sparkle config.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparkle-integration-'))
for (const name of ['data/profiles', 'config', 'cache']) {
  fs.mkdirSync(path.join(dir, name), { recursive: true })
}
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const write = (name, value) => fs.writeFileSync(path.join(dir, 'data', name), JSON.stringify(value))
write('config.yaml', {
  core: 'system',
  systemCorePath: path.join(root, 'extra/sidecar/mihomo'),
  coreStartupMode: 'log',
  corePermissionMode: 'elevated',
  sysProxy: { enable: false, guard: false },
  disableTray: true,
  autoCheckUpdate: false,
  notificationMode: 'app',
  appTheme: 'light',
  connectionInterval: 500,
  controlDns: true,
  controlSniff: true
})
write('mihomo.yaml', {
  'mixed-port': 17893,
  'external-controller': '127.0.0.1:19091',
  'allow-lan': false,
  mode: 'rule',
  ipv6: false,
  dns: { enable: false },
  sniffer: { enable: false },
  tun: { enable: false },
  'log-level': 'info',
  'find-process-mode': 'always'
})
write('profile.yaml', {
  current: 'integration',
  items: [{ id: 'integration', type: 'local', name: 'Integration' }]
})
write('profiles/integration.yaml', {
  proxies: [
    { name: 'Local A', type: 'direct' },
    { name: 'Local B', type: 'direct' }
  ],
  'proxy-groups': [{ name: 'Test Group', type: 'select', proxies: ['Local A', 'Local B'] }],
  'proxy-providers': {
    LocalProvider: { type: 'inline', payload: [{ name: 'Provider Direct', type: 'direct' }] }
  },
  'rule-providers': {
    LocalRules: {
      type: 'inline',
      behavior: 'classical',
      payload: ['IP-CIDR,127.0.0.0/8,no-resolve']
    }
  },
  rules: ['DOMAIN,localhost,REJECT', 'RULE-SET,LocalRules,Test Group', 'MATCH,Test Group']
})
fs.writeFileSync(
  path.join(dir, 'launch.cjs'),
  `const { app } = require('electron')\napp.setPath('userData', ${JSON.stringify(path.join(dir, 'data'))})\napp.setPath('sessionData', ${JSON.stringify(path.join(dir, 'session'))})\nrequire(${JSON.stringify(path.join(root, 'out/main/index.js'))})\n`
)
console.log(dir)
