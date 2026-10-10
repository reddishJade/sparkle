import type { MihomoLogEntry } from '@renderer/utils/mihomo-log-store'
import { useQuickRuleMenu } from '../rules/quick-rule-provider'
import { logRuleCandidates } from '@renderer/utils/quick-rule'
import { colorMap } from './log-item'
export default function LogTableRow({ log, index }: { log: MihomoLogEntry; index: number }) {
  const openRuleMenu = useQuickRuleMenu()
  return (
    <>
      <td>{log.seq ?? index + 1}</td>
      <td>{log.time}</td>
      <td className={colorMap[log.type]}>{log.type.toUpperCase()}</td>
      <td
        className="select-text"
        onContextMenu={(event) => openRuleMenu(event, logRuleCandidates(log.payload))}
      >
        {log.payload}
      </td>
    </>
  )
}
