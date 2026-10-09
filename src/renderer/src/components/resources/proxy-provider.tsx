import { Button, Chip, Card, Meter } from '@heroui/react'

import {
  mihomoProxyProviders,
  mihomoUpdateProxyProviders,
  getRuntimeConfig
} from '@renderer/utils/ipc'
import { useEffect, useMemo, useState } from 'react'
import Viewer from './viewer'
import ProviderNodes from './provider-nodes'
import useSWR from 'swr'
import { IoMdRefresh } from 'react-icons/io'
import { CgLoadbarDoc } from 'react-icons/cg'
import { MdEditDocument, MdQrCode2 } from 'react-icons/md'
import QRCodeModal from '../base/base-qrcode-modal'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
import { calcTraffic } from '@renderer/utils/calc'
import { getHash } from '@renderer/utils/hash'

import { notify } from '@renderer/utils/notification'

const ProxyProvider: React.FC = () => {
  const [showDetails, setShowDetails] = useState({
    show: false,
    path: '',
    type: '',
    title: '',
    providerType: '',
    ageSecretKey: ''
  })
  const [qrCode, setQrCode] = useState<{
    name: string
    url: string
  } | null>(null)
  useEffect(() => {
    if (showDetails.title) {
      const fetchProviderPath = async (name: string): Promise<void> => {
        try {
          const providers = await getRuntimeConfig()
          const provider = providers?.['proxy-providers']?.[name] as ProxyProviderConfig
          if (provider) {
            setShowDetails((prev) => ({
              ...prev,
              show: true,
              path: provider.path || `proxies/${getHash(provider.url || '')}`,
              ageSecretKey: provider['age-secret-key'] || ''
            }))
          }
        } catch {
          setShowDetails((prev) => ({ ...prev, path: '', ageSecretKey: '' }))
        }
      }
      fetchProviderPath(showDetails.title)
    }
  }, [showDetails.title])

  const { data, mutate, error, isLoading } = useSWR('mihomoProxyProviders', mihomoProxyProviders, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })

  useEffect(() => {
    const unsubscribeCoreStarted = window.electron.ipcRenderer.on('core-started', () => {
      mutate()
    })
    return (): void => {
      unsubscribeCoreStarted()
    }
  }, [])

  const providers = useMemo(() => {
    if (!data) return []
    return Object.values(data.providers)
      .filter((provider) => provider.vehicleType !== 'Compatible')
      .sort((a, b) => {
        const order = { File: 1, Inline: 2, HTTP: 3 }
        return (order[a.vehicleType] || 4) - (order[b.vehicleType] || 4)
      })
  }, [data])
  const [updating, setUpdating] = useState(Array(providers.length).fill(false))

  const onUpdate = async (name: string, index: number): Promise<void> => {
    setUpdating((prev) => {
      prev[index] = true
      return [...prev]
    })
    try {
      await mihomoUpdateProxyProviders(name)
      mutate()
    } catch (e) {
      notify(`${name} 更新失败\n${e}`, { variant: 'danger' })
    } finally {
      setUpdating((prev) => {
        prev[index] = false
        return [...prev]
      })
    }
  }

  if (!providers.length) {
    return (
      <div className="dashboard-empty">
        {isLoading ? (
          '正在读取代理集合…'
        ) : error ? (
          <>
            <p role="alert">读取代理集合失败：{String(error)}</p>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                void mutate()
              }}
            >
              重试
            </Button>
          </>
        ) : (
          '当前配置未包含代理集合'
        )}
      </div>
    )
  }

  const onShowQrCode = async (name: string): Promise<void> => {
    try {
      const config = await getRuntimeConfig()
      const provider = config?.['proxy-providers']?.[name] as ProxyProviderConfig
      if (provider?.url) {
        setQrCode({ name, url: provider.url })
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="provider-workspace">
      {qrCode && (
        <QRCodeModal title={qrCode.name} url={qrCode.url} onClose={() => setQrCode(null)} />
      )}
      {showDetails.show && (
        <Viewer
          path={showDetails.path}
          type={showDetails.type}
          title={showDetails.title}
          providerType={showDetails.providerType}
          ageSecretKey={showDetails.ageSecretKey || undefined}
          onClose={() =>
            setShowDetails({
              show: false,
              path: '',
              type: '',
              title: '',
              providerType: '',
              ageSecretKey: ''
            })
          }
        />
      )}
      <div className="provider-page-toolbar">
        <span>{providers.length} 个代理提供者</span>
        <Button
          size="sm"
          isIconOnly
          aria-label="更新全部代理提供者"
          variant="primary"
          onPress={() =>
            providers.forEach((provider, index) => {
              void onUpdate(provider.name, index)
            })
          }
        >
          <IoMdRefresh className="text-lg" />
        </Button>
      </div>
      <div className="provider-grid">
        {providers.map((provider, index) => (
          <Card key={provider.name} className="provider-card">
            <Card.Content>
              <div className="provider-card-heading">
                <div className="flex items-center min-w-0 gap-2">
                  <h2 className="truncate font-semibold" title={provider.name}>
                    {provider.name}
                  </h2>
                  <Chip size="sm" variant="soft">
                    <Chip.Label>{provider.proxies?.length ?? 0}</Chip.Label>
                  </Chip>
                </div>
                <div className="flex gap-1 shrink-0">
                  {provider.vehicleType === 'HTTP' && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={`${provider.name} 二维码`}
                      onPress={() => void onShowQrCode(provider.name)}
                    >
                      <MdQrCode2 />
                    </Button>
                  )}
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={`${provider.name} 查看文件`}
                    onPress={() =>
                      setShowDetails({
                        show: false,
                        providerType: 'proxy-providers',
                        path: provider.name,
                        type: provider.vehicleType,
                        title: provider.name,
                        ageSecretKey: ''
                      })
                    }
                  >
                    {provider.vehicleType === 'File' ? <MdEditDocument /> : <CgLoadbarDoc />}
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={`${provider.name} 更新`}
                    isDisabled={updating[index]}
                    onPress={() => void onUpdate(provider.name, index)}
                  >
                    <IoMdRefresh className={updating[index] ? 'animate-spin' : ''} />
                  </Button>
                </div>
              </div>
              <div className="provider-updated">更新于 {dayjs(provider.updatedAt).fromNow()}</div>
              {provider.subscriptionInfo && (
                <div className="provider-subscription">
                  <div className="flex justify-between gap-2 text-xs text-foreground-500">
                    <span>
                      {calcTraffic(
                        provider.subscriptionInfo.Upload + provider.subscriptionInfo.Download
                      )}{' '}
                      / {calcTraffic(provider.subscriptionInfo.Total)}
                    </span>
                    <span>
                      {provider.subscriptionInfo.Expire
                        ? `${dayjs.unix(provider.subscriptionInfo.Expire).format('YYYY-MM-DD')} 到期`
                        : '长期有效'}
                    </span>
                  </div>
                  <Meter
                    aria-label={`${provider.name} 流量使用`}
                    maxValue={Math.max(1, provider.subscriptionInfo.Total)}
                    value={provider.subscriptionInfo.Upload + provider.subscriptionInfo.Download}
                  >
                    <Meter.Track>
                      <Meter.Fill />
                    </Meter.Track>
                  </Meter>
                </div>
              )}
              <ProviderNodes
                provider={provider}
                refresh={() => {
                  void mutate()
                }}
              />
            </Card.Content>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default ProxyProvider
