import { Separator, InputGroup, Button } from '@heroui/react'

import RuleProvider from '@renderer/components/resources/rule-provider'
import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import { VirtuosoGrid } from 'react-virtuoso'
import { MdSort } from 'react-icons/md'
import { useMemo, useState } from 'react'
import { useRules } from '@renderer/hooks/use-rules'
import { includesIgnoreCase } from '@renderer/utils/includes'

const Rules: React.FC = () => {
  const { rules } = useRules()
  const [tab, setTab] = useState('rules')
  const [filter, setFilter] = useState('')
  const [enabled, setEnabled] = useState('all')
  const [type, setType] = useState('')
  const [target, setTarget] = useState('')
  const [sortByHits, setSortByHits] = useState(false)
  const types = useMemo(() => [...new Set(rules?.rules.map((rule) => rule.type) ?? [])], [rules])
  const targets = useMemo(() => [...new Set(rules?.rules.map((rule) => rule.proxy) ?? [])], [rules])

  const filteredRules = useMemo(() => {
    if (!rules) return []
    const matches = rules.rules.filter(
      (rule) =>
        (!filter ||
          [rule.payload, rule.type, rule.proxy].some((value) =>
            includesIgnoreCase(value, filter)
          )) &&
        (enabled === 'all' ||
          (enabled === 'enabled' ? !rule.extra.disabled : rule.extra.disabled)) &&
        (!type || rule.type === type) &&
        (!target || rule.proxy === target)
    )
    return sortByHits ? [...matches].sort((a, b) => b.extra.hitCount - a.extra.hitCount) : matches
  }, [rules, filter, enabled, type, target, sortByHits])

  const totalHitCount = useMemo(() => {
    if (!rules?.rules) return 0
    return rules.rules.reduce((acc, r) => acc + (r.extra?.hitCount || 0), 0)
  }, [rules])

  return (
    <BasePage title="分流规则">
      <div className="flex h-full flex-col">
        <div className="page-tabs">
          {[
            ['rules', '规则'],
            ['providers', '规则提供者']
          ].map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? 'primary' : 'ghost'}
              onPress={() => setTab(id)}
            >
              {label}
              {id === 'rules' && (
                <span className="text-xs opacity-70">{rules?.rules.length ?? 0}</span>
              )}
            </Button>
          ))}
        </div>
        <div className="flex-1 min-h-0">
          {tab === 'providers' ? (
            <RuleProvider />
          ) : (
            <div className="flex flex-col h-full">
              <div className="shrink-0 bg-background">
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
                <div className="rule-filterbar">
                  <div className="rule-filter-group" role="group" aria-label="规则状态">
                    {(
                      [
                        ['all', '全部'],
                        ['enabled', '已启用'],
                        ['disabled', '已禁用']
                      ] as const
                    ).map(([id, label]) => (
                      <Button
                        key={id}
                        size="sm"
                        variant={enabled === id ? 'primary' : 'ghost'}
                        onPress={() => setEnabled(id)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <div className="rule-filter-group" role="group" aria-label="规则类型">
                    {types.map((value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={type === value ? 'primary' : 'ghost'}
                        onPress={() => setType(type === value ? '' : value)}
                      >
                        {value}
                        <span className="text-xs opacity-60">
                          {rules?.rules.filter((rule) => rule.type === value).length}
                        </span>
                      </Button>
                    ))}
                  </div>
                  <div
                    className="rule-filter-group rule-filter-targets"
                    role="group"
                    aria-label="目标策略"
                  >
                    {targets.map((value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={target === value ? 'primary' : 'ghost'}
                        onPress={() => setTarget(target === value ? '' : value)}
                      >
                        {value}
                        <span className="text-xs opacity-60">
                          {rules?.rules.filter((rule) => rule.proxy === value).length}
                        </span>
                      </Button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    isIconOnly
                    variant={sortByHits ? 'primary' : 'ghost'}
                    aria-label="按命中次数排序"
                    onPress={() => setSortByHits(!sortByHits)}
                  >
                    <MdSort />
                  </Button>
                </div>
                <Separator />
              </div>
              <div className="rules-workspace flex-1 min-h-0 mt-px">
                <VirtuosoGrid
                  listClassName="rules-grid"
                  itemClassName="rules-grid-item"
                  data={filteredRules}
                  context={{ totalHitCount }}
                  itemContent={(_i, rule, context) => (
                    <RuleItem rule={rule} totalHitCount={context.totalHitCount} />
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </BasePage>
  )
}

export default Rules
