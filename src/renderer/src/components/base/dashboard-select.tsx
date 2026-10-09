import { ListBox, Select } from '@heroui/react'

export default function DashboardSelect({
  label,
  value,
  options,
  onChange,
  className = 'w-32'
}: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      data-size="sm"
      className={className}
      onChange={(key) => {
        if (key !== null) onChange(String(key))
      }}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map(([id, name]) => (
            <ListBox.Item key={id} id={id} textValue={name}>
              {name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
