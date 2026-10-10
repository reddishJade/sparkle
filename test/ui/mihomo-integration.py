import json, time, threading, socket, urllib.request, re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

class Target(BaseHTTPRequestHandler):
 def do_HEAD(self):
  self.send_response(200); self.end_headers()
 def do_GET(self):
  self.send_response(200); self.end_headers()
  try:
   for _ in range(180):
    self.wfile.write(b'x'*2048); self.wfile.flush(); time.sleep(.1)
  except (BrokenPipeError, ConnectionResetError): pass
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',18081),Target)
threading.Thread(target=server.serve_forever,daemon=True).start()
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def api(path): return json.load(opener.open('http://127.0.0.1:19091'+path))
def traffic():
 s=socket.create_connection(('127.0.0.1',17893))
 s.sendall(b'GET http://127.0.0.1:18081/stream HTTP/1.1\r\nHost: 127.0.0.1:18081\r\nConnection: close\r\n\r\n')
 def consume():
  try:
   while s.recv(8192): pass
  except OSError: pass
 threading.Thread(target=consume,daemon=True).start()
 return s
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:19223')
 page=b.contexts[0].pages[0]
 runtime=page.evaluate('()=>window.electron.ipcRenderer.invoke("getRuntimeConfig")')
 config=page.evaluate('()=>window.electron.ipcRenderer.invoke("getAppConfig")')
 assert runtime['mixed-port']==17893 and not runtime.get('tun',{}).get('enable',False)
 assert 'LocalRules' in runtime.get('rule-providers',{}) and not config['sysProxy']['enable']
 errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
 page.get_by_text('已连接到 Mihomo',exact=True).wait_for(timeout=15000)
 latency=page.evaluate('()=>window.electron.ipcRenderer.invoke("getNetworkLatencies",[{name:"Local fixture",url:"http://127.0.0.1:18081/"}])')
 assert isinstance(latency['Local fixture'],(int,float)) and latency['Local fixture']>0,latency
 print('PASS: custom latency URL through running Mihomo',latency,flush=True)
 assert opener.open(urllib.request.Request('http://localhost:18081/',method='HEAD')).status==200
 rejected=page.evaluate('()=>window.electron.ipcRenderer.invoke("getNetworkLatencies",[{name:"Rule rejected",url:"http://localhost:18081/"}])')
 assert rejected['Rule rejected'] is None,rejected
 print('PASS: active DOMAIN rule rejects a directly reachable probe target',flush=True)
 if page.locator('.driver-popover-close-btn').count(): page.locator('.driver-popover-close-btn').click()
 page.evaluate("location.hash='/home'")
 page.get_by_text('网络拓扑',exact=True).wait_for()
 stream=traffic(); time.sleep(2)
 connections=api('/connections')['connections']; assert connections
 print('PASS: real connection through',connections[0]['chains'],flush=True)
 page.locator('.topology-node').filter(has_text='Test Group').wait_for()
 page.screenshot(path='/tmp/sparkle-real/home.png')
 page.evaluate("location.hash='/proxies'")
 page.get_by_role('button',name='代理提供者',exact=True).wait_for()
 page.get_by_role('button').filter(has_text='Test Group').first.click()
 page.get_by_role('button').filter(has_text='Local B').first.click()
 time.sleep(.6)
 assert api('/proxies/Test%20Group')['now']=='Local B'
 stream.close(); stream=traffic(); time.sleep(1)
 page.get_by_role('button',name='代理提供者',exact=True).click()
 page.get_by_text('LocalProvider',exact=True).wait_for()
 page.get_by_role('button',name='查看节点 (1)',exact=True).click()
 page.get_by_text('Provider Direct',exact=True).wait_for()
 page.evaluate("location.hash='/rules'")
 page.get_by_role('button',name='规则提供者',exact=True).click()
 page.get_by_text('LocalRules',exact=True).wait_for()
 page.locator('.page-tabs').get_by_role('button',name='规则',exact=False).first.click()
 page.get_by_role('button',name='规则设置',exact=True).click()
 page.get_by_role('switch',name='禁用规则时打断连接',exact=True).press('Space')
 page.get_by_role('button',name=re.compile('规则样式')).click()
 page.get_by_role('option',name='表格',exact=True).click()
 page.locator('[data-slot="modal-close-trigger"]').click()
 page.locator('.rule-table th').first.wait_for()
 page.get_by_role('switch',name='启用规则 2',exact=True).locator('xpath=ancestor::*[@data-slot="switch"]//span[@data-slot="switch-control"]').click()
 page.wait_for_timeout(500)
 assert not api('/connections')['connections']
 stream.close()
 page.get_by_role('switch',name='启用规则 2',exact=True).locator('xpath=ancestor::*[@data-slot="switch"]//span[@data-slot="switch-control"]').click()
 page.wait_for_timeout(500)
 stream=traffic();time.sleep(1)
 assert api('/connections')['connections']
 print('PASS: real rule table disable closes matching connections and re-enable restores routing',flush=True)
 page.evaluate("location.hash='/connections'")
 page.get_by_role('button',name='关闭连接',exact=True).first.wait_for()
 assert page.get_by_role('button',name='表格',exact=True).count()==0
 page.screenshot(path='/tmp/sparkle-real/connections.png')
 page.evaluate("location.hash='/traffic'")
 page.get_by_role('heading',name='设备用量',exact=True).wait_for()
 page.locator('.usage-layout').get_by_role('button',name='127.0.0.1',exact=True).click()
 page.locator('.usage-layout').get_by_role('button',name='127.0.0.1',exact=True).last.click()
 page.get_by_role('heading',name='127.0.0.1 · 节点',exact=True).wait_for()
 page.get_by_text('Local B',exact=True).last.wait_for()
 query={'start':int((time.time()-3600)*1000),'end':int(time.time()*1000),'dimension':'sourceIP'}
 usage=page.evaluate('(q)=>window.electron.ipcRenderer.invoke("getUsage",q)',query)
 assert usage['totalDownload']>0,usage
 session=page.evaluate('(q)=>window.electron.ipcRenderer.invoke("getUsage",{...q,session:true})',query)
 assert session['totalDownload']>0,session
 print('PASS: recorded real download bytes',usage['totalDownload'],flush=True)
 page.evaluate('()=>window.electron.ipcRenderer.invoke("mihomoCloseConnections")')
 time.sleep(1)
 assert not api('/connections')['connections']
 stream.close()
 page.evaluate("location.hash='/home'")
 page.get_by_text('暂无活动连接。产生代理流量后，拓扑会自动更新。',exact=True).wait_for()
 stream=traffic(); time.sleep(1)
 page.locator('.topology-node').filter(has_text='Test Group').wait_for()
 page.evaluate('()=>window.electron.ipcRenderer.invoke("stopCore")')
 page.wait_for_timeout(600)
 assert page.get_by_text('暂无活动连接。产生代理流量后，拓扑会自动更新。',exact=True).count()==1
 page.get_by_text('等待内核连接…',exact=True).wait_for()
 before=page.evaluate('(q)=>window.electron.ipcRenderer.invoke("getUsage",q)',query)
 page.evaluate('()=>window.electron.ipcRenderer.invoke("restartCore")')
 page.get_by_text('已连接到 Mihomo',exact=True).wait_for(timeout=15000)
 after=page.evaluate('(q)=>window.electron.ipcRenderer.invoke("getUsage",q)',query)
 assert (before['totalDownload'],before['totalUpload'])==(after['totalDownload'],after['totalUpload'])
 session=page.evaluate('(q)=>window.electron.ipcRenderer.invoke("getUsage",{...q,session:true})',query)
 assert session['totalDownload']==0 and session['totalUpload']==0,session
 page.evaluate('()=>window.electron.ipcRenderer.invoke("stopCore")')
 page.get_by_text('等待内核连接…',exact=True).wait_for()
 assert not errors,errors
 print('PASSED REAL MIHOMO + ELECTRON',flush=True)
 stream.close()
server.shutdown()
