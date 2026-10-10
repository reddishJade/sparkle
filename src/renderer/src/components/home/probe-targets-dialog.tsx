import { Button, Checkbox, Input, Modal } from '@heroui/react'
import { useState } from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
import { validateNetworkTargets, type NetworkTarget } from '../../../../shared/network-targets'

export default function ProbeTargetsDialog({
  title,
  targets,
  selected,
  onSave,
  onClose
}: {
  title: string
  targets: NetworkTarget[]
  selected?: string[]
  onSave: (targets: NetworkTarget[], selected: string[]) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(() => targets.map((target) => ({ ...target })))
  const [checked, setChecked] = useState(() =>
    targets.flatMap((target, index) => (selected?.includes(target.name) ? [index] : []))
  )
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  function save(): void {
    try {
      const normalized = validateNetworkTargets(draft)
      if (selected && checked.length !== 4) throw new Error('请选择 4 个首页展示项目')
      onSave(
        normalized,
        checked.map((index) => normalized[index].name)
      )
      onClose()
    } catch (error) {
      setError(String(error instanceof Error ? error.message : error))
    }
  }
  return (
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-160 max-w-[calc(100vw-32px)]">
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {selected && (
                <p className="text-sm text-foreground-500 mb-3">
                  {draft.length} 个项目 · 首页展示 {checked.length} / 4 项
                </p>
              )}
              <Input
                aria-label="搜索检测项目"
                placeholder="搜索名称或网址"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mb-3"
              />
              <div className="probe-target-editor">
                {draft
                  .map((target, index) => ({ target, index }))
                  .filter(({ target }) =>
                    `${target.name} ${target.url}`
                      .toLowerCase()
                      .includes(search.trim().toLowerCase())
                  )
                  .map(({ target, index }) => (
                    <div key={index} className="probe-target-row">
                      {selected && (
                        <Checkbox
                          aria-label={`展示 ${target.name || index + 1}`}
                          isSelected={checked.includes(index)}
                          isDisabled={!checked.includes(index) && checked.length === 4}
                          onChange={(value) =>
                            setChecked(
                              value ? [...checked, index] : checked.filter((item) => item !== index)
                            )
                          }
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                      )}
                      <Input
                        aria-label={`测试名称 ${index + 1}`}
                        value={target.name}
                        placeholder="名称"
                        onChange={(event) =>
                          setDraft(
                            draft.map((item, i) =>
                              i === index ? { ...item, name: event.target.value } : item
                            )
                          )
                        }
                      />
                      <Input
                        aria-label={`测试网址 ${index + 1}`}
                        value={target.url}
                        placeholder="https://"
                        onChange={(event) =>
                          setDraft(
                            draft.map((item, i) =>
                              i === index ? { ...item, url: event.target.value } : item
                            )
                          )
                        }
                      />
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={`删除测试项目 ${index + 1}`}
                        onPress={() => {
                          setDraft(draft.filter((_, i) => i !== index))
                          setChecked(
                            checked.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i))
                          )
                        }}
                      >
                        <FiTrash2 />
                      </Button>
                    </div>
                  ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                isDisabled={draft.length >= 64}
                onPress={() => setDraft([...draft, { name: '', url: '' }])}
              >
                <FiPlus />
                添加测试网址
              </Button>
              {error && (
                <p className="text-danger text-sm" role="alert">
                  {error}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={onClose}>
                取消
              </Button>
              <Button variant="primary" onPress={save}>
                保存
              </Button>
            </Modal.Footer>
            <Modal.CloseTrigger />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
