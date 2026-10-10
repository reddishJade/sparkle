import { Button, Card, Chip, Switch } from '@heroui/react'
import { FiRefreshCw } from 'react-icons/fi'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { notify } from '@renderer/utils/notification'
import RuleDetailTooltip from './rule-detail-tooltip'

interface Props {
  policy: React.ReactNode
  onToggle: (enabled: boolean) => Promise<void>
  onUpdate: () => Promise<void>
  rule: ControllerRulesDetail
  totalHitCount?: number
}

const RuleItem: React.FC<Props> = ({ rule, totalHitCount = 0, policy, onToggle, onUpdate }) => {
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
      await onToggle(v)
    } catch (error) {
      setIsEnabled(!v)
      notify(error, { variant: 'danger' })
    }
  }

  return (
    <div className="rule-list-row" data-rule-index={rule.index}>
      <Card>
        <Card.Content className="rule-card-content">
          <div className="rule-identity">
            <div className="rule-card-name-row">
              <span className="text-xs text-foreground-500">{rule.index + 1}</span>
              <div className="truncate rule-name" title={rule.payload || 'Match'}>
                {rule.payload || 'Match'}
              </div>
              {rule.type === 'RuleSet' && (
                <>
                  <span className="text-xs text-foreground-500">
                    ({rule.size.toLocaleString()})
                  </span>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={`更新规则集 ${rule.payload}`}
                    onPress={() => void onUpdate()}
                  >
                    <FiRefreshCw />
                  </Button>
                </>
              )}
            </div>
            <div className="rule-mainline text-foreground-500">
              <span>{rule.type}</span>
              <span className="truncate">{policy}</span>
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
