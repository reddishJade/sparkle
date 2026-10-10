import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { FiMove } from 'react-icons/fi'

export const homeWidgetLabels: Record<string, string> = {
  download: '下载速度',
  upload: '上传速度',
  connections: '活动连接',
  memory: '内核内存',
  traffic: '实时流量',
  topology: '网络拓扑',
  active: '活跃节点',
  ip: '出口 IP',
  latency: '网络延迟',
  services: '流媒体 / AI'
}
export const defaultHomeWidgets: HomeWidgetConfig[] = Object.keys(homeWidgetLabels).map((id) => ({
  id,
  span: id === 'traffic' || id === 'topology' ? 6 : 3,
  height:
    id === 'traffic' || id === 'topology'
      ? 280
      : ['download', 'upload', 'connections', 'memory'].includes(id)
        ? 144
        : 208
}))
export function normalizeHomeWidgets(saved?: HomeWidgetConfig[]): HomeWidgetConfig[] {
  const seen = new Set<string>()
  const result: HomeWidgetConfig[] = []
  for (const item of Array.isArray(saved) ? saved : []) {
    const preset = defaultHomeWidgets.find((widget) => widget.id === item?.id)
    if (!preset || seen.has(item.id)) continue
    seen.add(item.id)
    result.push({
      id: item.id,
      span: [3, 6, 9, 12].includes(item.span) ? item.span : preset.span,
      height: [144, 208, 280, 360].includes(item.height) ? item.height : preset.height,
      hidden: item.hidden === true
    })
  }
  return [...result, ...defaultHomeWidgets.filter((item) => !seen.has(item.id))]
}
function HomeWidget({
  widget,
  editing,
  children
}: {
  widget: HomeWidgetConfig
  editing: boolean
  children: ReactNode
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing
  })
  return (
    <div
      ref={setNodeRef}
      data-home-widget={widget.id}
      className={`home-widget ${editing ? 'is-editing' : ''}`}
      style={{
        gridColumn: `span ${widget.span}`,
        height: widget.height + (editing ? 32 : 0),
        transform: CSS.Transform.toString(
          transform ? { ...transform, scaleX: 1, scaleY: 1 } : null
        ),
        transition,
        zIndex: isDragging ? 10 : undefined
      }}
    >
      {editing && (
        <button
          type="button"
          className="home-widget-handle"
          aria-label={`拖动${homeWidgetLabels[widget.id]}`}
          {...attributes}
          {...listeners}
        >
          <FiMove />
          {homeWidgetLabels[widget.id]}
        </button>
      )}
      <div className="home-widget-body">{children}</div>
    </div>
  )
}
export default function HomeWidgetLayout({
  widgets,
  editing,
  content,
  onChange
}: {
  widgets: HomeWidgetConfig[]
  editing: boolean
  content: Record<string, ReactNode>
  onChange: (widgets: HomeWidgetConfig[]) => void
}) {
  const visible = widgets.filter((widget) => !widget.hidden)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return
        onChange(
          arrayMove(
            widgets,
            widgets.findIndex((widget) => widget.id === active.id),
            widgets.findIndex((widget) => widget.id === over.id)
          )
        )
      }}
    >
      <SortableContext items={visible.map((widget) => widget.id)} strategy={rectSortingStrategy}>
        <div className="home-widget-grid">
          {visible.map((widget) => (
            <HomeWidget key={widget.id} widget={widget} editing={editing}>
              {content[widget.id]}
            </HomeWidget>
          ))}
        </div>
      </SortableContext>
      {!visible.length && <p className="dashboard-empty">暂无显示组件，可在主页设置中添加。</p>}
    </DndContext>
  )
}
