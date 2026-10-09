from playwright.sync_api import sync_playwright
from pathlib import Path
import os
import json
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
    assert page.locator('.topology-node').count()>0
    page.locator('.topology-node').filter(has_text='DomainSuffix').first.click()
    assert page.locator('.topology-node').filter(has_text='192.168.1.2').count()>0
    page.locator('.topology-viewport').scroll_into_view_if_needed()
    page.screenshot(path='/tmp/sparkle-topology.png',full_page=True)
    page.get_by_role('button',name='暂停',exact=True).click()
    page.get_by_role('button',name='继续',exact=True).click()
    page.evaluate("location.hash='/proxies'")
    page.get_by_role('button',name='代理集合',exact=True).wait_for()
    page.get_by_role('button',name='连通性',exact=True).click()
    page.get_by_role('button',name='开始测试',exact=True).click()
    page.get_by_text('50 ms',exact=True).first.wait_for()
    page.get_by_role('button',name='Close',exact=True).click()
    page.get_by_role('button',name='展开 / 折叠全部',exact=True).click()
    page.get_by_role('button',name='全部测速',exact=True).click()
    page.get_by_role('button',name='全部测速',exact=True).wait_for()
    page.get_by_label('代理布局').select_option('table')
    assert page.locator('.data-table').count()>0
    page.get_by_label('代理布局').select_option('master')
    page.screenshot(path='/tmp/sparkle-proxies.png',full_page=True)
    page.get_by_role('button',name='代理集合',exact=True).click()
    page.get_by_role('button',name='查看节点 (3)',exact=True).click()
    page.get_by_role('button',name='健康检查',exact=True).click()
    page.get_by_role('button',name='健康检查',exact=True).wait_for()
    page.evaluate("location.hash='/rules'")
    page.get_by_role('button',name='规则集合',exact=True).click()
    page.get_by_text('Geo',exact=True).wait_for()
    page.get_by_role('button',name='地理数据库',exact=True).click()
    page.get_by_text('GeoIP-DAT 数据库',exact=True).wait_for()
    page.evaluate("location.hash='/connections'")
    page.get_by_label('设备筛选').wait_for()
    page.wait_for_timeout(1000)
    page.get_by_label('设备筛选').select_option('192.168.1.2')
    assert page.locator('.data-table tbody tr').count()==1
    page.get_by_label('设备筛选').select_option('')
    with page.expect_download() as download:
        page.get_by_role('button',name='CSV',exact=True).click()
    assert download.value.suggested_filename=='sparkle-connections.csv'
    page.screenshot(path='/tmp/sparkle-connections.png',full_page=True)
    page.evaluate("location.hash='/traffic'")
    page.get_by_role('heading',name='设备用量',exact=True).wait_for()
    page.locator('.usage-layout').get_by_role('button',name='192.168.1.2',exact=True).click()
    page.locator('.usage-layout').get_by_role('button',name='example.com',exact=True).wait_for()
    page.locator('.usage-layout').get_by_role('button',name='example.com',exact=True).click()
    page.get_by_role('heading',name='example.com · 节点',exact=True).wait_for()
    page.screenshot(path='/tmp/sparkle-usage.png',full_page=True)
    page.get_by_label('时间范围').select_option('-1')
    assert page.locator('input[type=datetime-local]').count()==2
    page.get_by_label('数据保留时长').select_option('3600000')
    page.get_by_role('dialog').wait_for()
    page.get_by_role('button',name='取消',exact=True).click()
    page.evaluate("window.__setTheme('dark')")
    page.evaluate("location.hash='/home'")
    page.get_by_text('网络拓扑',exact=True).wait_for()
    page.wait_for_timeout(500)
    page.screenshot(path='/tmp/sparkle-home-dark.png',full_page=True)
    page.set_viewport_size({'width':850,'height':700})
    page.locator('.content').evaluate('(element) => element.scrollTop = 0')
    assert page.get_by_text('网络拓扑',exact=True).bounding_box()['y'] < 350
    page.screenshot(path='/tmp/sparkle-home-compact.png',full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.evaluate("window.__emit('appConfigUpdated',{});localStorage.removeItem('proxy-expanded')")
    assert not errors,errors
    print(json.dumps({'passed':True,'page_errors':errors,'screenshots':['home-light','home-dark','proxies','connections','usage'],'ipc_calls':len(page.evaluate('window.__calls'))}))
    browser.close()
