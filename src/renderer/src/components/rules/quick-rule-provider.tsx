import { Button, Input, Label, ListBox, Modal, Select } from '@heroui/react'
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { parse, stringify } from 'yaml'
import { useOverrideConfig } from '@renderer/hooks/use-override-config'
import {
  addOverrideItem,
  getOverride,
  getOverrideConfig,
  mihomoProxies,
  restartCore,
  setOverride
} from '@renderer/utils/ipc'
import { notify } from '@renderer/utils/notification'
import { buildQuickRule, type RuleCandidate } from '@renderer/utils/quick-rule'

const Context = createContext<(event: MouseEvent, candidates: RuleCandidate[]) => void>(() => {})
export const useQuickRuleMenu = () => useContext(Context)
const overrideId = 'sparkle-quick-rules'
const ruleTypes = ['DOMAIN', 'DOMAIN-SUFFIX', 'IP-CIDR', 'PROCESS-NAME', 'PROCESS-PATH']

export default function QuickRuleProvider({ children }: { children: ReactNode }) {
  const { mutateOverrideConfig } = useOverrideConfig()
  const [menu, setMenu] = useState<{ x: number; y: number; candidates: RuleCandidate[] }>()
  const [candidates, setCandidates] = useState<RuleCandidate[]>()
  const [type, setType] = useState('DOMAIN')
  const [value, setValue] = useState('')
  const [policy, setPolicy] = useState('DIRECT')
  const [policies, setPolicies] = useState(['DIRECT', 'REJECT'])
  const [saving, setSaving] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    menuRef.current?.querySelector('button')?.focus()
    const close = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(undefined)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(undefined)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', escape)
    }
  }, [menu])

  const open = async () => {
    if (!menu) return
    const initial = menu.candidates[0]
    setCandidates(menu.candidates)
    setType(initial?.type || 'DOMAIN')
    setValue(initial?.value || '')
    setPolicy('DIRECT')
    setMenu(undefined)
    try {
      const result = await mihomoProxies()
      setPolicies([
        ...new Set([
          'DIRECT',
          'REJECT',
          ...Object.keys(result.proxies).filter((name) => name !== 'GLOBAL')
        ])
      ])
    } catch (error) {
      notify(error, { variant: 'danger' })
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const rule = buildQuickRule(type, value, policy)
      const config = await getOverrideConfig()
      const item = config.items.find((item) => item.id === overrideId)
      if (item && (item.ext !== 'yaml' || !item.global))
        throw new Error('快捷规则覆写必须是已启用的全局 YAML 覆写')
      const patch = item ? parse(await getOverride(overrideId, 'yaml')) : { '+rules': [] }
      if (
        !patch ||
        typeof patch !== 'object' ||
        Array.isArray(patch) ||
        !Array.isArray(patch['+rules'])
      ) {
        throw new Error('快捷规则覆写格式无效，请在覆写页面检查 +rules')
      }
      patch['+rules'] = [rule, ...patch['+rules'].filter((existing: string) => existing !== rule)]
      const content = stringify(patch)
      if (item) await setOverride(overrideId, 'yaml', content)
      else {
        await addOverrideItem({
          id: overrideId,
          name: '快捷分流规则',
          type: 'local',
          ext: 'yaml',
          global: true,
          file: content
        })
      }
      mutateOverrideConfig()
      setCandidates(undefined)
      try {
        await restartCore()
        notify('规则已保存并生效', { variant: 'success' })
      } catch (error) {
        notify(`规则已保存，但内核重启失败：${error}`, { variant: 'danger' })
      }
    } catch (error) {
      notify(error, { variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Context.Provider
      value={(event, next) => {
        event.preventDefault()
        event.stopPropagation()
        setMenu({
          x: Math.min(event.clientX, window.innerWidth - 180),
          y: Math.min(event.clientY, window.innerHeight - 52),
          candidates: next
        })
      }}
    >
      {children}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            aria-label="规则操作"
            className="fixed z-[100] min-w-40 rounded-lg border border-default-200 bg-surface p-1 shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            <Button variant="ghost" className="w-full justify-start" onPress={() => void open()}>
              新增规则
            </Button>
          </div>,
          document.body
        )}
      {candidates && (
        <Modal>
          <Modal.Backdrop
            isOpen
            onOpenChange={(open) => {
              if (!open && !saving) setCandidates(undefined)
            }}
            variant="blur"
            className="top-12 h-[calc(100%-48px)]"
          >
            <Modal.Container>
              <Modal.Dialog>
                <Modal.Header>
                  <Modal.Heading>新增分流规则</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-3">
                  <p className="text-sm text-foreground-500">
                    保存到全局「快捷分流规则」覆写，置于原规则前；保存后重启内核。可在覆写页面编辑或删除。
                  </p>
                  <Select
                    aria-label="规则类型"
                    value={type}
                    onChange={(key) => {
                      if (typeof key !== 'string') return
                      setType(key)
                      setValue(candidates.find((candidate) => candidate.type === key)?.value || '')
                    }}
                  >
                    <Label>规则类型</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {ruleTypes.map((type) => (
                          <ListBox.Item key={type} id={type} textValue={type}>
                            {type}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <Label>匹配内容</Label>
                  <Input
                    aria-label="匹配内容"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={candidates.length ? '请输入匹配内容' : '未识别到目标，请手动填写'}
                  />
                  <Select
                    aria-label="目标策略"
                    value={policy}
                    onChange={(key) => {
                      if (typeof key === 'string') setPolicy(key)
                    }}
                  >
                    <Label>目标策略</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {policies.map((policy) => (
                          <ListBox.Item key={policy} id={policy} textValue={policy}>
                            {policy}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    variant="secondary"
                    isDisabled={saving}
                    onPress={() => setCandidates(undefined)}
                  >
                    取消
                  </Button>
                  <Button isDisabled={saving || !value.trim()} onPress={() => void save()}>
                    {saving ? '保存中…' : '保存并生效'}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </Context.Provider>
  )
}
