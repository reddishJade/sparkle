from playwright.sync_api import sync_playwright
from pathlib import Path
import os
import json
import re
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--no-proxy-server'])
    page=browser.new_page(viewport={'width':1360,'height':950},device_scale_factor=1)
    page.add_init_script(Path(__file__).with_name('dashboard-fixtures.js').read_text())
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(os.environ.get('SPARKLE_PREVIEW_URL', 'http://127.0.0.1:8765'))
    page.wait_for_load_state('networkidle')
    page.get_by_text('网络拓扑',exact=True).wait_for()
    assert page.url.endswith('#/home'),page.url
    assert page.get_by_text('外部资源',exact=True).count()==0
    page.wait_for_timeout(1600)
    page.screenshot(path='/tmp/sparkle-home-light.png',full_page=True)
    units = page.locator('.home-bottom > .home-unit')
    assert units.count() == 4
    assert len(set(units.evaluate_all('(cards) => cards.map(card => card.offsetHeight)'))) == 1
    page.get_by_role('button',name='配置网络延迟网址',exact=True).click()
    page.get_by_label('测试名称 1',exact=True).fill('自定义站点')
    page.get_by_label('测试网址 1',exact=True).fill('file:///not-a-network-url')
    page.get_by_role('button',name='保存',exact=True).click()
    page.get_by_role('alert').wait_for()
    page.get_by_label('测试网址 1',exact=True).fill('https://example.com/generate_204')
    page.get_by_role('button',name='保存',exact=True).click()
    page.get_by_text('自定义站点',exact=True).wait_for()
    assert page.evaluate("JSON.parse(localStorage.getItem('home-latency-targets'))[0].url") == 'https://example.com/generate_204'
    page.get_by_role('button',name='选择流媒体 AI 检测项目',exact=True).click()
    page.get_by_role('checkbox',name='展示 Netflix',exact=True).press('Space')
    page.get_by_role('checkbox',name='展示 Disney+',exact=True).press('Space')
    page.get_by_role('button',name='保存',exact=True).click()
    page.get_by_role('button',name='开始流媒体 AI 检测',exact=True).click()
    page.get_by_role('button',name='开始流媒体 AI 检测',exact=True).wait_for(state='visible')
    page.wait_for_timeout(200)
    assert page.evaluate("JSON.parse(localStorage.getItem('home-service-selected'))") == ['YouTube','OpenAI','Gemini','Disney+']
    urls = [call[2] for call in page.evaluate('window.__calls') if call[0] == 'mihomoProxyDelay']
    assert 'https://www.disneyplus.com/' in urls and not any('netflix.com' in url for url in urls)
    assert page.locator('.topology-node').count()>0
    page.locator('.topology-node').filter(has_text='Tokyo').first.click()
    page.locator('.topology-node').filter(has_text='DomainSuffix').first.click()
    assert page.locator('.topology-node').filter(has_text='192.168.1.2').count()>0
    page.locator('.topology-viewport').scroll_into_view_if_needed()
    page.screenshot(path='/tmp/sparkle-topology.png',full_page=True)
    page.get_by_role('button',name='暂停',exact=True).click()
    page.get_by_role('button',name='继续',exact=True).click()
    page.evaluate("location.hash='/proxies'")
    page.get_by_role('button',name='代理提供者',exact=True).wait_for()
    assert page.get_by_role('button',name='连通性',exact=True).count()==0
    assert page.get_by_label('代理布局').count()==0
    page.get_by_role('button').filter(has_text='Proxy').first.click()
    page.wait_for_timeout(500)
    page.screenshot(path='/tmp/sparkle-proxies.png',full_page=True)
    page.get_by_role('button',name='代理提供者',exact=True).click()
    page.get_by_role('button',name='查看节点 (3)',exact=True).click()
    page.get_by_role('button',name='延迟测试',exact=True).click()
    page.get_by_role('button',name='延迟测试',exact=True).wait_for()
    page.evaluate("location.hash='/rules'")
    page.get_by_role('button',name='已禁用',exact=True).click()
    assert page.get_by_text('example.com',exact=True).count()==0
    page.get_by_role('button',name='全部',exact=True).click()
    page.screenshot(path='/tmp/sparkle-rules.png',full_page=True)
    page.get_by_role('button',name='规则提供者',exact=True).click()
    page.get_by_text('Geo',exact=True).wait_for()
    assert page.get_by_role('button',name='地理数据库',exact=True).count()==0
    page.evaluate("location.hash='/mihomo'")
    page.get_by_role('button',name='地理数据库',exact=True).click()
    page.get_by_text('GeoIP-DAT 数据库',exact=True).wait_for()
    page.evaluate("location.hash='/connections'")
    page.wait_for_timeout(1200)
    assert page.get_by_label('设备筛选').count()==0
    assert page.get_by_role('button',name='表格',exact=True).count()==0
    page.screenshot(path='/tmp/sparkle-connections.png',full_page=True)
    page.evaluate("location.hash='/traffic'")
    page.get_by_role('heading',name='设备用量',exact=True).wait_for()
    page.wait_for_timeout(500)
    page.screenshot(path='/tmp/sparkle-usage.png',full_page=True)
    page.get_by_role('button', name=re.compile('时间范围')).click()
    page.get_by_role('option', name='本次运行', exact=True).click()
    assert any(call[1].get('session') for call in page.evaluate('window.__calls') if call[0] == 'getUsage')
    page.get_by_role('button', name=re.compile('时间范围')).click()
    page.get_by_role('option', name='最近 7 日', exact=True).click()
    page.locator('.usage-layout').get_by_role('button',name='192.168.1.2',exact=True).click()
    page.locator('.usage-layout').get_by_role('button',name='example.com',exact=True).wait_for()
    page.locator('.usage-layout').get_by_role('button',name='example.com',exact=True).click()
    page.get_by_role('heading',name='example.com · 节点',exact=True).wait_for()
    page.screenshot(path='/tmp/sparkle-usage-detail.png',full_page=True)
    page.get_by_role('button', name=re.compile('时间范围')).click()
    page.get_by_role('option', name='自定义', exact=True).click()
    assert page.locator('input[type=datetime-local]').count()==2
    page.get_by_role('button', name=re.compile('数据保留时长')).click()
    page.get_by_role('option', name='保留 1 小时', exact=True).click()
    page.get_by_role('dialog', name='缩短数据保留时长').wait_for()
    page.get_by_role('button',name='取消',exact=True).click()
    page.evaluate("window.__setTheme('dark')")
    page.evaluate("location.hash='/home'")
    page.get_by_text('网络拓扑',exact=True).wait_for()
    page.wait_for_timeout(500)
    page.screenshot(path='/tmp/sparkle-home-dark.png',full_page=True)
    page.set_viewport_size({'width':850,'height':700})
    page.locator('.content').evaluate('(element) => element.scrollTop = 0')
    assert page.locator('.topology-viewport').bounding_box()['height'] <= 232
    page.screenshot(path='/tmp/sparkle-home-compact.png',full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('.topology-viewport').evaluate('(el) => el.scrollWidth <= el.clientWidth + 2')
    page.evaluate("location.hash='/traffic'")
    page.get_by_role('button', name=re.compile('时间范围')).click()
    page.get_by_role('option', name='本次运行', exact=True).click()
    page.wait_for_timeout(600)
    page.screenshot(path='/tmp/sparkle-usage-compact-dark.png',full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.evaluate("window.__emit('appConfigUpdated',{});localStorage.removeItem('proxy-expanded')")
    page.evaluate("location.hash='/logs'")
    page.get_by_role('button',name='暂停日志',exact=True).wait_for()
    page.evaluate("window.__emit('mihomoLogs',{type:'info',payload:'日志暂停验证-初始',time:'10:00:00',seq:1})")
    page.get_by_text('日志暂停验证-初始',exact=True).wait_for()
    page.get_by_role('button',name='暂停日志',exact=True).click()
    before = page.locator('.content').inner_text()
    page.evaluate("for(let i=2;i<=602;i++) window.__emit('mihomoLogs',{type:'info',payload:'日志暂停验证-'+i,time:'10:00:01',seq:i})")
    page.wait_for_timeout(450)
    assert page.locator('.content').inner_text() == before
    page.get_by_role('button',name='继续日志',exact=True).click()
    page.get_by_text('日志暂停验证-602',exact=True).wait_for()
    page.get_by_role('button',name='暂停日志',exact=True).click()
    page.get_by_role('button',name='清空日志',exact=True).click()
    assert page.get_by_text('日志暂停验证-602',exact=True).count()==0
    page.evaluate("window.__emit('mihomoLogs',{type:'info',payload:'清空后新日志',time:'10:00:02',seq:603})")
    page.wait_for_timeout(100)
    assert page.get_by_text('清空后新日志',exact=True).count()==0
    page.get_by_role('button',name='继续日志',exact=True).click()
    page.get_by_text('清空后新日志',exact=True).wait_for()
    page.evaluate("location.hash='/settings'")
    page.get_by_text('侧边栏设置',exact=True).click()
    page.get_by_role('tablist',name='系统代理显示方式',exact=True).wait_for()
    assert page.get_by_role('tablist',name='DNS显示方式',exact=True).count()==0
    assert page.get_by_role('tablist',name='域名嗅探显示方式',exact=True).count()==0
    for route in ['home','proxies','rules','connections','traffic','logs','settings','profiles','override','mihomo','dns','sniffer','sysproxy','tun']:
        page.evaluate('(route) => location.hash = "/"+route',route)
        page.wait_for_timeout(300)
        assert page.locator('.header button').evaluate_all('(buttons) => buttons.every(button => button.textContent.trim() === "")'),route
        assert page.locator('.header [title]').count()==0,route
    assert not errors,errors
    print(json.dumps({'passed':True,'page_errors':errors,'screenshots':['home-light','home-dark','proxies','connections','usage'],'ipc_calls':len(page.evaluate('window.__calls'))}))
    browser.close()
