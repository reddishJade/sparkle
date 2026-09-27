import yaml from 'yaml'
import { readFileSync, writeFileSync } from 'fs'

const pkg = readFileSync('package.json', 'utf-8')
let changelog = readFileSync('changelog.md', 'utf-8')
const { version } = JSON.parse(pkg)
const tag = process.env.RELEASE_TAG || `v${version}`
const repo = process.env.GITHUB_REPOSITORY || 'reddishJade/sparkle'
const downloadUrl = `https://github.com/${repo}/releases/download/${tag}`
const latest = {
  version,
  tag,
  changelog
}

if (process.env.SKIP_CHANGELOG !== '1') {
  changelog += '\n### 下载地址：\n\n#### Windows (x64)：\n\n'
  changelog += `- 便携版：[sparkle-windows-${version}-x64-portable.7z](${downloadUrl}/sparkle-windows-${version}-x64-portable.7z)\n`
  changelog += `- 安装版：[sparkle-windows-${version}-x64-setup.exe](${downloadUrl}/sparkle-windows-${version}-x64-setup.exe)\n`
}
writeFileSync('latest.yml', yaml.stringify(latest))
writeFileSync('changelog.md', changelog)
