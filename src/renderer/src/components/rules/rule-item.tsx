import { Card, Chip, Switch } from '@heroui/react'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRules } from '@renderer/hooks/use-rules'
import { mihomoRulesDisable } from '@renderer/utils/ipc'
import RuleDetailTooltip from './rule-detail-tooltip'

interface Props {
  rule: ControllerRulesDetail
  totalHitCount?: number
}

const RuleItem: React.FC<Props> = ({ rule, totalHitCount = 0 }) => {
  const { mutate } = useRules()
  const [isEnabled, setIsEnabled] = useState(!rule.extra.disabled)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  const { hitCount } = rule.extra
  const hitRatio = totalHitCount > 0 ? (hitCount / totalHitCount) * 100 : 0
  const hitRatioText = hitRatio >= 0.1 ? `${hitRatio.toFixed(1)}%` : '<0.1%'

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
    <div className="rule-list-row" data-rule-index={rule.index}>
      <Card>
        <Card.Content className="rule-card-content">
          <div className="rule-identity">
            <div className="truncate rule-name" title={rule.payload || 'Match'}>
              {rule.payload || 'Match'}
            </div>
            <div className="rule-mainline text-foreground-500">
              <span>{rule.type}</span>
              <span className="truncate">{rule.proxy}</span>
            </div>
          </div>
          <div
            className="rule-actions"
            ref={wrapperRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <Switch size="sm" isSelected={isEnabled} onChange={handleToggle} aria-label="启用">
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
            {hitCount > 0 && totalHitCount > 0 && (
              <Chip size="sm" data-color="primary" variant="soft" aria-label="命中占比">
                <Chip.Label>{hitRatioText}</Chip.Label>
              </Chip>
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
