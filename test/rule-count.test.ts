import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ruleCount } from '../src/renderer/src/components/rules/rule-count'

describe('Rule provider counts', () => {
  const rule = { type: 'RuleSet', payload: 'test', size: -1 } as ControllerRulesDetail
  it('resolves an unknown rule size from its provider and preserves zero', () => {
    assert.equal(
      ruleCount(rule, { test: { ruleCount: 15412 } as ControllerRuleProviderDetail }),
      15412
    )
    assert.equal(ruleCount(rule, { test: { ruleCount: 0 } as ControllerRuleProviderDetail }), 0)
  })
  it('does not display sentinel values or counts for ordinary rules', () => {
    assert.equal(ruleCount(rule), undefined)
    assert.equal(ruleCount({ ...rule, size: 42 }), 42)
    assert.equal(
      ruleCount({ ...rule, size: 42 }, { test: { ruleCount: -1 } as ControllerRuleProviderDetail }),
      42
    )
    assert.equal(ruleCount({ ...rule, type: 'Domain', size: -1 }), undefined)
  })
})
