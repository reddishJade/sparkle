from playwright.sync_api import sync_playwright
from pathlib import Path
import os,re

with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--no-proxy-server'])
 page=b.new_page(viewport={'width':1456,'height':1141})
 page.add_init_script(Path(__file__).with_name('dashboard-fixtures.js').read_text())
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ['SPARKLE_PREVIEW_URL']);page.wait_for_load_state('networkidle')
 assert page.locator('[data-home-widget]').count()==10
 assert page.get_by_text('按当前规则检测',exact=False).count()==0
 page.get_by_role('button',name='编辑主页布局',exact=True).click()
 source=page.get_by_role('button',name='拖动内核内存',exact=True).bounding_box()
 target=page.get_by_role('button',name='拖动上传速度',exact=True).bounding_box()
 page.mouse.move(source['x']+source['width']/2,source['y']+source['height']/2)
 page.mouse.down();page.mouse.move(source['x']+source['width']/2-10,source['y']+source['height']/2,steps=3)
 page.mouse.move(target['x']+target['width']/2,target['y']+target['height']/2,steps=15);page.mouse.up()
 page.wait_for_function("document.querySelectorAll('[data-home-widget]')[1].dataset.homeWidget==='memory'")
 saved=page.evaluate("()=>window.electron.ipcRenderer.invoke('getAppConfig')")['homeWidgets']
 assert saved[1]['id']=='memory',saved
 page.get_by_role('button',name='完成主页编辑',exact=True).click()
 page.get_by_role('button',name='主页组件设置',exact=True).click()
 page.get_by_role('switch',name='显示活动连接',exact=True).press('Space')
 page.get_by_role('button',name=re.compile('实时流量宽度')).click()
 page.get_by_role('option',name='整行',exact=True).click()
 page.get_by_role('button',name=re.compile('实时流量高度')).click()
 page.get_by_role('option',name='大',exact=True).click()
 page.locator('[data-slot="modal-close-trigger"]').click()
 assert not page.locator('[data-home-widget="connections"]').count()
 trend=page.locator('[data-home-widget="traffic"]').bounding_box()
 grid=page.locator('.home-widget-grid').bounding_box()
 assert abs(trend['width']-grid['width'])<2 and trend['height']==360
 page.evaluate("location.hash='/rules'");page.get_by_text('example.com',exact=True).wait_for()
 page.evaluate("location.hash='/home'");page.get_by_role('button',name='主页组件设置',exact=True).wait_for()
 assert page.locator('[data-home-widget]').nth(1).get_attribute('data-home-widget')=='memory'
 assert not page.locator('[data-home-widget="connections"]').count()
 page.screenshot(path='/tmp/sparkle-home-custom-widgets.png')
 page.get_by_role('button',name='主页组件设置',exact=True).click()
 page.get_by_role('button',name='恢复默认布局',exact=True).click()
 page.locator('[data-slot="modal-close-trigger"]').click()
 assert page.locator('[data-home-widget]').count()==10
 assert page.locator('[data-home-widget]').nth(1).get_attribute('data-home-widget')=='upload'
 assert not errors,errors
 page.screenshot(path='/tmp/sparkle-home-widget-default.png')
 print('PASS: home mouse drag, width/height, visibility, saved layout and reset')
 b.close()
