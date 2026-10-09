import { Chip, Card, Switch } from '@heroui/react'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRules } from '@renderer/hooks/use-rules'
import { mihomoRulesDisable } from '@renderer/utils/ipc'
import RuleDetailTooltip from './rule-detail-tooltip'

import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface Props {
  index: number
  rule: ControllerRulesDetail
  totalHitCount?: number
}

const RuleItem: React.FC<Props> = ({ rule, index, totalHitCount = 0 }) => {
  const { mutate } = useRules()
  const [isEnabled, setIsEnabled] = useState(!rule.extra.disabled)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  const { hitCount } = rule.extra

  const hasStats = Boolean(hitCount > 0 && totalHitCount > 0)
  const hitRatio = hasStats ? (hitCount / totalHitCount) * 100 : 0
  const hitRatioText = hitRatio >= 0.1 ? `${hitRatio.toFixed(1)}%` : hitRatio > 0 ? '<0.1%' : '0%'

  useEffect(() => {
    setIsEnabled(!rule.extra.disabled)
  }, [rule, rule.extra.disabled])

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setShowTooltip(true), 600)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setShowTooltip(false)
  }, [])

  useEffect(() => {
    if (!showTooltip) return
    const handleMouseMove = (e: MouseEvent): void => {
      if (!wrapperRef.current) return
      const rect = wrapperRef.current.getBoundingClientRect()
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        setShowTooltip(false)
      }
    }
    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [showTooltip])

  const handleToggle = async (v: boolean): Promise<void> => {
    setIsEnabled(v)
    try {
      await mihomoRulesDisable({ [rule.index]: !v })
      mutate()
    } catch {
      setIsEnabled(!v)
    }
  }

  return (
    <div className={`w-full px-2 pb-2 ${index === 0 ? 'pt-2' : ''}`}>
      <Card>
        <Card.Content className="w-full">
          <div className="truncate font-semibold mb-2" title={rule.payload || 'Match'}>
            {rule.payload || 'Match'}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Switch size="sm" isSelected={isEnabled} onChange={handleToggle} aria-label="启用">
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
            <Chip size="sm" data-color="primary" variant="soft">
              <Chip.Label>{rule.type}</Chip.Label>
            </Chip>
            <span className="text-foreground-500">→</span>
            <Chip size="sm" data-color="secondary" variant="soft">
              <Chip.Label>{rule.proxy}</Chip.Label>
            </Chip>
            <div
              className="flex items-center gap-2"
              ref={wrapperRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <Chip size="sm" data-color="success" variant="soft">
                <Chip.Label>{hitCount ?? 0}</Chip.Label>
              </Chip>
              <Chip size="sm" data-color="warning" variant="soft">
                <Chip.Label>{rule.extra.missCount ?? 0}</Chip.Label>
              </Chip>
              {hasStats && <span className="text-foreground-500">{hitRatioText}</span>}
            </div>
            {rule.extra.hitAt && Date.parse(rule.extra.hitAt) > 0 && (
              <span className="text-foreground-500">
                最近命中 {dayjs(rule.extra.hitAt).fromNow()}
              </span>
            )}
            {rule.extra.missAt && Date.parse(rule.extra.missAt) > 0 && (
              <span className="text-foreground-500">
                最近未命中 {dayjs(rule.extra.missAt).fromNow()}
              </span>
            )}
          </div>
        </Card.Content>
      </Card>
      <RuleDetailTooltip
        rule={rule}
        totalHitCount={totalHitCount}
        anchorEl={showTooltip ? wrapperRef.current : null}
        visible={showTooltip}
      />
    </div>
  )
}

export default RuleItem
