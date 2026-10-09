import { useId, useState } from 'react'
export default function HistoryChart({
  series,
  labels,
  format = String,
  timestamps = []
}: {
  series: number[][]
  labels: string[]
  format?: (value: number) => string
  timestamps?: number[]
}) {
  const id = useId().replaceAll(':', '')
  const [hover, setHover] = useState<number | null>(null)
  const count = Math.max(0, ...series.map((values) => values.length))
  const max = Math.max(1, ...series.flat())
  const colors = ['var(--accent)', 'var(--success)']
  const timeLabel = (time?: number) =>
    time
      ? new Date(time).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      : '—'
  const active = hover === null ? null : Math.min(hover, count - 1)
  return (
    <div className="history-chart relative">
      <div className="flex justify-between text-xs text-foreground-500">
        <span>{format(max)}</span>
        <span>
          {labels.map((label, i) => (
            <span key={label} className="ml-3" style={{ color: colors[i % colors.length] }}>
              {label}
            </span>
          ))}
        </span>
      </div>
      <svg
        viewBox="0 0 600 150"
        preserveAspectRatio="none"
        role="img"
        aria-label={labels.join('、')}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          setHover(
            Math.max(
              0,
              Math.min(
                count - 1,
                Math.round(((event.clientX - bounds.left) / bounds.width) * (count - 1))
              )
            )
          )
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="0"
            x2="600"
            y1={i * 45 + 10}
            y2={i * 45 + 10}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
        ))}
        {series.map((values, i) => {
          const data = values.length === 1 ? [values[0], values[0]] : values
          const points = data
            .map(
              (value, index) =>
                `${(index / Math.max(1, data.length - 1)) * 600},${145 - (value / max) * 130}`
            )
            .join(' ')
          return (
            <g key={i}>
              <defs>
                <linearGradient id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor={colors[i % 2]} stopOpacity=".2" />
                  <stop offset="1" stopColor={colors[i % 2]} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`0,150 ${points} 600,150`} fill={`url(#${id}-${i})`} />
              <polyline
                points={points}
                fill="none"
                stroke={colors[i % 2]}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
        {active !== null && active >= 0 && (
          <line
            x1={(active / Math.max(1, count - 1)) * 600}
            x2={(active / Math.max(1, count - 1)) * 600}
            y1="0"
            y2="150"
            stroke="var(--foreground)"
            strokeOpacity=".4"
            strokeDasharray="3 3"
          />
        )}
      </svg>
      {active !== null && active >= 0 && (
        <div className="pointer-events-none absolute top-8 right-2 p-2 rounded-lg border border-border bg-surface text-xs shadow-sm">
          <div className="text-foreground-500 mb-1">
            {timestamps[active]
              ? new Date(timestamps[active]).toLocaleString()
              : `采样 ${active + 1}`}
          </div>
          {labels.map((label, i) => (
            <div key={label} style={{ color: colors[i % 2] }}>
              {label}：{format(series[i]?.[active] ?? 0)}
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between text-xs text-foreground-500">
        <span>{timeLabel(timestamps[0])}</span>
        <span>{timeLabel(timestamps.at(-1))}</span>
      </div>
    </div>
  )
}
