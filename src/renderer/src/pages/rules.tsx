import { Separator, InputGroup, Button, Switch } from '@heroui/react'

import RuleProvider from '@renderer/components/resources/rule-provider'
import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import { Virtuoso, TableVirtuoso } from 'react-virtuoso'
import DashboardSelect from '@renderer/components/base/dashboard-select'
import { useMemo, useState } from 'react'
import { useRules } from '@renderer/hooks/use-rules'
import { includesIgnoreCase } from '@renderer/utils/includes'

import { MdTune } from 'react-icons/md'
import { FiRefreshCw } from 'react-icons/fi'
import PageViewSettings from '@renderer/components/base/page-view-settings'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { useLiveData } from '@renderer/hooks/use-live-data'
import {
  mihomoRulesDisable,
  mihomoCloseConnection,
  mihomoUpdateRuleProviders
} from '@renderer/utils/ipc'
import { notify } from '@renderer/utils/notification'

const Rules: React.FC = () => {
  const { rules, mutate } = useRules()
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    ruleView = 'cards',
    ruleShowNode = true,
    ruleShowDelay = true,
    ruleDisconnect = false
  } = appConfig || {}
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { groups = [] } = useGroups()
  const live = useLiveData()
  function selectedNode(name: string): { name: string; delay?: number } | undefined {
    const seen = new Set<string>()
    let group = groups.find((group) => group.name === name)
    let node: ControllerProxiesDetail | undefined
    while (group && !seen.has(group.name)) {
      seen.add(group.name)
      const next = group.now
      node = group.all.find((node) => node.name === next)
      group = groups.find((group) => group.name === next)
      if (!group) return node ? { name: node.name, delay: node.history?.at(-1)?.delay } : undefined
    }
    return undefined
  }
  async function toggleRule(rule: ControllerRulesDetail, enabled: boolean): Promise<void> {
    await mihomoRulesDisable({ [rule.index]: !enabled })
    void mutate()
    if (!enabled && ruleDisconnect) {
      const matching = (live.connections.connections ?? []).filter(
        (connection) => connection.rule === rule.type && connection.rulePayload === rule.payload
      )
      const results = await Promise.allSettled(
        matching.map((connection) => mihomoCloseConnection(connection.id))
      )
      if (results.some((result) => result.status === 'rejected'))
        notify('规则已禁用，部分连接关闭失败', { variant: 'danger' })
    }
  }
  async function updateRule(rule: ControllerRulesDetail): Promise<void> {
    try {
      await mihomoUpdateRuleProviders(rule.payload)
      mutate()
    } catch (error) {
      notify(error, { variant: 'danger' })
    }
  }
  function policy(rule: ControllerRulesDetail): React.ReactNode {
    const node = selectedNode(rule.proxy)
    return (
      <span className="rule-policy">
        {rule.proxy}
        {ruleShowNode && node && (
          <>
            {' '}
            › {node.name}
            {ruleShowDelay && node.delay !== undefined && (
              <span className="text-success ml-2">
                {node.delay > 0 ? `${node.delay} ms` : '超时'}
              </span>
            )}
          </>
        )}
      </span>
    )
  }

  const [tab, setTab] = useState('rules')
  const [filter, setFilter] = useState('')
  const [enabled, setEnabled] = useState('all')
  const [type, setType] = useState('')
  const [target, setTarget] = useState('')
  const [sort, setSort] = useState('order')
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
    return sort === 'hits'
      ? [...matches].sort((a, b) => b.extra.hitCount - a.extra.hitCount)
      : sort === 'name'
        ? [...matches].sort((a, b) => a.payload.localeCompare(b.payload))
        : matches
  }, [rules, filter, enabled, type, target, sort])

  const totalHitCount = useMemo(() => {
    if (!rules?.rules) return 0
    return rules.rules.reduce((acc, r) => acc + (r.extra?.hitCount || 0), 0)
  }, [rules])

  return (
    <BasePage
      title="分流规则"
      header={
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label="规则设置"
          onPress={() => setSettingsOpen(true)}
        >
          <MdTune />
        </Button>
      }
    >
      {settingsOpen && (
        <PageViewSettings title="规则设置" onClose={() => setSettingsOpen(false)}>
          <div className="view-setting-row">
            <span>规则样式</span>
            <DashboardSelect
              label="规则样式"
              value={ruleView}
              options={[
                ['cards', '卡片'],
                ['table', '表格']
              ]}
              onChange={(value) => void patchAppConfig({ ruleView: value as 'cards' | 'table' })}
            />
          </div>
          {(
            [
              ['ruleShowNode', '显示选中节点', ruleShowNode],
              ['ruleShowDelay', '显示延迟数字', ruleShowDelay],
              ['ruleDisconnect', '禁用规则时打断连接', ruleDisconnect]
            ] as const
          ).map(([key, label, value]) => (
            <div className="view-setting-row" key={key}>
              <span>{label}</span>
              <Switch
                aria-label={label}
                isSelected={value}
                onChange={(value) => void patchAppConfig({ [key]: value })}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>
          ))}
        </PageViewSettings>
      )}
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
                <div className="rule-search-toolbar">
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
                  <DashboardSelect
                    label="规则状态"
                    value={enabled}
                    options={[
                      ['all', '全部'],
                      ['enabled', '已启用'],
                      ['disabled', '已禁用']
                    ]}
                    onChange={setEnabled}
                  />
                  <DashboardSelect
                    label="规则类型"
                    value={type}
                    options={[
                      ['', '全部类型'],
                      ...types.map((value) => [value, value] as [string, string])
                    ]}
                    onChange={setType}
                  />
                  <DashboardSelect
                    label="规则排序"
                    value={sort}
                    options={[
                      ['order', '规则顺序'],
                      ['hits', '命中次数'],
                      ['name', '名称']
                    ]}
                    onChange={setSort}
                  />
                </div>
                <div className="rule-filterbar">
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
                </div>
                <Separator />
              </div>
              <div className="rules-workspace flex-1 min-h-0 mt-px">
                {ruleView === 'table' ? (
                  <TableVirtuoso
                    className="rule-table"
                    data={filteredRules}
                    fixedHeaderContent={() => (
                      <tr>
                        {[
                          '#',
                          '类型',
                          '内容',
                          '策略组',
                          '规则数',
                          '命中 / 未命中',
                          '状态',
                          '操作'
                        ].map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    )}
                    itemContent={(_i, rule) => (
                      <>
                        <td>{rule.index + 1}</td>
                        <td>{rule.type}</td>
                        <td>{rule.payload || 'Match'}</td>
                        <td>{policy(rule)}</td>
                        <td>{rule.size || '—'}</td>
                        <td>
                          {rule.extra.hitCount.toLocaleString()} /{' '}
                          {rule.extra.missCount.toLocaleString()}
                        </td>
                        <td>
                          <Switch
                            aria-label={`启用规则 ${rule.index + 1}`}
                            size="sm"
                            isSelected={!rule.extra.disabled}
                            onChange={(value) =>
                              void toggleRule(rule, value).catch((error) =>
                                notify(error, { variant: 'danger' })
                              )
                            }
                          >
                            <Switch.Content>
                              <Switch.Control>
                                <Switch.Thumb />
                              </Switch.Control>
                            </Switch.Content>
                          </Switch>
                        </td>
                        <td>
                          {rule.type === 'RuleSet' && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              aria-label={`更新规则集 ${rule.payload}`}
                              onPress={() => void updateRule(rule)}
                            >
                              <FiRefreshCw />
                            </Button>
                          )}
                        </td>
                      </>
                    )}
                  />
                ) : (
                  <Virtuoso
                    data={filteredRules}
                    context={{ totalHitCount }}
                    itemContent={(_i, rule, context) => (
                      <RuleItem
                        rule={rule}
                        totalHitCount={context.totalHitCount}
                        policy={policy(rule)}
                        onToggle={(value) => toggleRule(rule, value)}
                        onUpdate={() => updateRule(rule)}
                      />
                    )}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </BasePage>
  )
}

export default Rules
