import { Separator, InputGroup, Button } from '@heroui/react'

import RuleProvider from '@renderer/components/resources/rule-provider'
import GeoData from '@renderer/components/resources/geo-data'
import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import { Virtuoso } from 'react-virtuoso'
import { useMemo, useState } from 'react'
import { useRules } from '@renderer/hooks/use-rules'
import { includesIgnoreCase } from '@renderer/utils/includes'

const Rules: React.FC = () => {
  const { rules } = useRules()
  const [tab, setTab] = useState('rules')
  const [filter, setFilter] = useState('')

  const filteredRules = useMemo(() => {
    if (!rules) return []
    if (filter === '') return rules.rules
    return rules.rules.filter((rule) => {
      return (
        includesIgnoreCase(rule.payload, filter) ||
        includesIgnoreCase(rule.type, filter) ||
        includesIgnoreCase(rule.proxy, filter)
      )
    })
  }, [rules, filter])

  const totalHitCount = useMemo(() => {
    if (!rules?.rules) return 0
    return rules.rules.reduce((acc, r) => acc + (r.extra?.hitCount || 0), 0)
  }, [rules])

  return (
    <BasePage
      title="分流规则"
      header={
        <div className="flex gap-1 app-nodrag">
          {[
            ['rules', '规则'],
            ['providers', '规则集合'],
            ['geo', '地理数据库']
          ].map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? 'primary' : 'ghost'}
              onPress={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      }
    >
      {tab === 'providers' ? (
        <RuleProvider />
      ) : tab === 'geo' ? (
        <GeoData />
      ) : (
        <>
          <div className="sticky top-0 z-40">
            <div className="flex p-2">
              <InputGroup fullWidth>
                <InputGroup.Input
                  value={filter}
                  placeholder="筛选过滤"
                  onChange={(event) => setFilter(event.target.value)}
                />
                {filter && (
                  <InputGroup.Suffix>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label="清空"
                      onPress={(event) => {
                        setFilter('')
                        event.target
                          .closest('[data-slot="input-group"]')
                          ?.querySelector('input')
                          ?.focus()
                      }}
                    >
                      ×
                    </Button>
                  </InputGroup.Suffix>
                )}
              </InputGroup>
            </div>
            <Separator />
          </div>
          <div className="h-[calc(100vh-100px)] mt-px">
            <Virtuoso
              data={filteredRules}
              context={{ totalHitCount }}
              itemContent={(i, rule, context) => (
                <RuleItem index={i} rule={rule} totalHitCount={context.totalHitCount} />
              )}
            />
          </div>
        </>
      )}
    </BasePage>
  )
}

export default Rules
