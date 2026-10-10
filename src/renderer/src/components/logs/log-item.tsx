import { Card } from '@heroui/react'
import { useQuickRuleMenu } from '../rules/quick-rule-provider'
import { logRuleCandidates } from '@renderer/utils/quick-rule'

import React, { useEffect, useState } from 'react'

export const colorMap: Record<LogLevel, string> = {
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-primary',
  debug: 'text-default-500',
  silent: 'text-default-500'
}

interface Props extends ControllerLog {
  index: number
  animateOnMount?: boolean
}

const LogItemComponent: React.FC<Props> = (props) => {
  const { type, payload, time, index, animateOnMount = false } = props
  const [entered, setEntered] = useState(!animateOnMount)
  const openRuleMenu = useQuickRuleMenu()

  useEffect(() => {
    if (!animateOnMount) {
      setEntered(true)
      return
    }

    setEntered(false)
    const frame = window.requestAnimationFrame(() => {
      setEntered(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [animateOnMount])

  return (
    <div
      onContextMenu={(event) => openRuleMenu(event, logRuleCandidates(payload))}
      className={`px-2 pb-2 transition-[opacity,transform] duration-300 ease-out ${entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'} ${index === 0 ? 'pt-2' : ''}`}
    >
      <Card className={animateOnMount ? 'ring-1 ring-primary/12' : ''}>
        <Card.Header className="log-card-heading pb-0 pt-1">
          <small className="text-foreground-500">{index}</small>
          <div className={`text-xs font-medium ${colorMap[type]}`}>{props.type.toUpperCase()}</div>
          <small className="text-foreground-500 ml-auto">{time}</small>
        </Card.Header>
        <Card.Content className="select-text pt-0 text-sm">{payload}</Card.Content>
      </Card>
    </div>
  )
}

const LogItem = React.memo(LogItemComponent)

export default LogItem
