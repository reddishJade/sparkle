import { Chip, Switch } from '@heroui/react'

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
    <div className="rule-list-row">
      <span className="rule-order">{rule.index + 1}</span>
      <div className="rule-identity">
        <div className="truncate font-semibold" title={rule.payload || 'Match'}>
          {rule.payload || 'Match'}
        </div>
        <div className="rule-mainline flex items-center gap-2 text-xs">
          <Chip size="sm" data-color="primary" variant="soft">
            <Chip.Label>{rule.type}</Chip.Label>
          </Chip>
          <span className="text-foreground-500">→</span>
          <span className="truncate text-foreground-500">{rule.proxy}</span>
        </div>
      </div>
      <div className="rule-statistics">
        <div
          className="flex items-center justify-end gap-3 text-xs"
          ref={wrapperRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <span>
            命中 <span className="text-success">{hitCount ?? 0}</span>
          </span>
          <span>
            未命中 <span className="text-foreground-500">{rule.extra.missCount ?? 0}</span>
          </span>
          {hitCount > 0 && totalHitCount > 0 && (
            <span className="text-foreground-500">{hitRatioText}</span>
          )}
        </div>
        <div className="rule-times text-xs text-foreground-500">
          {rule.extra.hitAt && Date.parse(rule.extra.hitAt) > 0 && (
            <span>最近命中 {dayjs(rule.extra.hitAt).fromNow()}</span>
          )}
          {rule.extra.missAt && Date.parse(rule.extra.missAt) > 0 && (
            <span>最近未命中 {dayjs(rule.extra.missAt).fromNow()}</span>
          )}
        </div>
      </div>
      <Switch size="sm" isSelected={isEnabled} onChange={handleToggle} aria-label="启用">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
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
