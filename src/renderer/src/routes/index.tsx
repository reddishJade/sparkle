import { useLayoutEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { markInitialContentPartReady } from '@renderer/utils/startup'
import {
  Connections,
  Traffic,
  DNS,
  Logs,
  Mihomo,
  Override,
  Profiles,
  Proxies,
  Home,
  Rules,
  Settings,
  Sniffer,
  Sysproxy,
  Tun
} from './route-pages'

export { useDeferredRoutePreload } from './route-pages'

function StartupRoute({ children }: { children: ReactNode }): ReactNode {
  useLayoutEffect(() => {
    markInitialContentPartReady('route')
  }, [])
  return children
}

function startupRoute(element: ReactNode): ReactNode {
  return <StartupRoute>{element}</StartupRoute>
}

const routes = [
  { path: '/resources', element: <Navigate to="/rules" replace /> },
  {
    path: '/mihomo',
    element: startupRoute(<Mihomo />)
  },
  {
    path: '/sysproxy',
    element: startupRoute(<Sysproxy />)
  },
  {
    path: '/tun',
    element: startupRoute(<Tun />)
  },
  {
    path: '/proxies',
    element: startupRoute(<Proxies />)
  },
  {
    path: '/rules',
    element: startupRoute(<Rules />)
  },
  {
    path: '/home',
    element: startupRoute(<Home />)
  },
  {
    path: '/dns',
    element: startupRoute(<DNS />)
  },
  {
    path: '/sniffer',
    element: startupRoute(<Sniffer />)
  },
  {
    path: '/logs',
    element: startupRoute(<Logs />)
  },
  {
    path: '/connections',
    element: startupRoute(<Connections />)
  },
  {
    path: '/traffic',
    element: startupRoute(<Traffic />)
  },
  {
    path: '/override',
    element: startupRoute(<Override />)
  },
  {
    path: '/profiles',
    element: startupRoute(<Profiles />)
  },
  {
    path: '/settings',
    element: startupRoute(<Settings />)
  },
  {
    path: '/',
    element: <Navigate to="/home" replace />
  }
]

export default routes
