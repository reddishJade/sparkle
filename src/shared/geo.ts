export const defaultGeoxUrl = {
  geoip: 'https://github.com/appshubcc/bett-rules/releases/download/latest/geoip.dat',
  geosite: 'https://github.com/appshubcc/bett-rules/releases/download/latest/geosite.dat',
  mmdb: 'https://github.com/appshubcc/bett-rules/releases/download/latest/geoip.metadb',
  asn: 'https://github.com/appshubcc/bett-rules/releases/download/latest/GeoLite2-ASN.mmdb'
}

// Only migrate the former defaults; custom URLs must remain untouched.
export function migrateGeoxUrl(
  urls: Partial<typeof defaultGeoxUrl> | undefined
): Partial<typeof defaultGeoxUrl> | undefined {
  if (!urls) return undefined

  const migrated = { ...urls }
  let changed = false
  for (const key of Object.keys(defaultGeoxUrl) as (keyof typeof defaultGeoxUrl)[]) {
    const legacyUrl = defaultGeoxUrl[key].replace(
      'appshubcc/bett-rules',
      'MetaCubeX/meta-rules-dat'
    )
    if (urls[key] === legacyUrl) {
      migrated[key] = defaultGeoxUrl[key]
      changed = true
    }
  }
  return changed ? migrated : undefined
}
