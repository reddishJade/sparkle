import { Button, Tooltip, Card } from '@heroui/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IoStatsChart } from 'react-icons/io5'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React, { useEffect, useState } from 'react'
import { FaCircleArrowDown, FaCircleArrowUp } from 'react-icons/fa6'
import { calcTrafficTotal as calcTraffic } from '@renderer/utils/calc'
import { getTrafficStats } from '@renderer/utils/ipc'

interface Props {
  iconOnly?: boolean
}

const TrafficCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly } = props
  const [traffic, setTraffic] = useState({ upload: 0, download: 0 })

  useEffect(() => {
    if (iconOnly) return
    let disposed = false
    let loading = false
    const refresh = async (): Promise<void> => {
      if (loading) return
      loading = true
      try {
        const stats = await getTrafficStats('session')
        if (!disposed) {
          setTraffic({ upload: stats.totalUpload, download: stats.totalDownload })
        }
      } catch {
        // 保留上一次统计，等待下一次刷新
      } finally {
        loading = false
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 1000)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [iconOnly])
  const { trafficCardStatus = 'col-span-2', disableAnimation = false } = appConfig || {}
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/traffic')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'traffic'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null

  if (iconOnly) {
    return (
      <div className={`${trafficCardStatus} flex justify-center`}>
        <Tooltip delay={0}>
          <Button
            size="sm"
            isIconOnly
            onPress={() => {
              navigate('/traffic')
            }}
            variant={match ? 'primary' : 'ghost'}
            data-color={match ? 'primary' : 'default'}
          >
            <IoStatsChart className="text-[20px]" />
          </Button>
          <Tooltip.Content placement="right">{'用量'}</Tooltip.Content>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${trafficCardStatus} traffic-card`}
    >
      <Card
        {...attributes}
        {...listeners}
        className={[
          'w-full',
          `${match ? 'bg-primary' : 'hover:bg-primary/30'} ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Card.Content className="pb-1 pt-0 px-0 overflow-y-visible">
          <div className="flex justify-between">
            <Button
              isIconOnly
              variant="secondary"
              data-color="default"
              className="bg-transparent pointer-events-none"
            >
              <IoStatsChart
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px] font-bold`}
              />
            </Button>
            {trafficCardStatus === 'col-span-2' && (
              <div
                aria-label="本次内核运行累计流量"
                className={`p-2 w-full ${match ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                <div className="flex justify-between">
                  <div className="w-full text-right mr-2">{calcTraffic(traffic.upload)}</div>
                  <FaCircleArrowUp aria-label="上传" className="h-6 leading-6" />
                </div>
                <div className="flex justify-between">
                  <div className="w-full text-right mr-2">{calcTraffic(traffic.download)}</div>
                  <FaCircleArrowDown aria-label="下载" className="h-6 leading-6" />
                </div>
              </div>
            )}
          </div>
        </Card.Content>
        <Card.Footer className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            用量
          </h3>
        </Card.Footer>
      </Card>
    </div>
  )
}

export default React.memo(TrafficCard, (prevProps, nextProps) => {
  return prevProps.iconOnly === nextProps.iconOnly
})
