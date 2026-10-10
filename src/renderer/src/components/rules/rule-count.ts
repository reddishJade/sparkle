export function ruleCount(
  rule: ControllerRulesDetail,
  providers?: Record<string, ControllerRuleProviderDetail>
): number | undefined {
  if (rule.type !== 'RuleSet') return undefined
  const providerCount = providers?.[rule.payload]?.ruleCount
  const count =
    providerCount !== undefined && Number.isFinite(providerCount) && providerCount >= 0
      ? providerCount
      : rule.size
  return Number.isFinite(count) && count >= 0 ? count : undefined
}
