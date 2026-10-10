from playwright.sync_api import sync_playwright
from pathlib import Path
import os, re
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--no-proxy-server'])
 page=b.new_page(viewport={'width':1200,'height':900})
 page.add_init_script(Path(__file__).with_name('dashboard-fixtures.js').read_text()+'''
 const originalInvoke=window.electron.ipcRenderer.invoke;
 const disabled=new Map();
 window.electron.ipcRenderer.invoke=async (name,...args)=>{
   const response=await originalInvoke(name,...args);
   if(name==='mihomoRulesDisable') for(const [index,value] of Object.entries(args[0])) disabled.set(Number(index),value);
   if(name==='mihomoRules') for(const rule of response.rules) rule.extra.disabled=disabled.get(rule.index)??false;
   return response;
 };
 ''')
 errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto(os.environ['SPARKLE_PREVIEW_URL']);page.wait_for_load_state('networkidle')
 page.evaluate("location.hash='/rules'")
 page.get_by_text('example.com',exact=True).wait_for()
 for label in ['规则状态','规则类型','规则排序']:
  assert page.get_by_role('button',name=re.compile(label)).count()==1
 page.get_by_role('button',name=re.compile('规则排序')).click()
 page.get_by_role('option',name='命中次数',exact=True).click()
 page.get_by_role('button',name='规则设置',exact=True).click()
 assert page.get_by_role('button',name='规则设置',exact=True).evaluate("el => getComputedStyle(el.closest('.header')).webkitAppRegion") == 'no-drag'
 page.get_by_role('switch',name='禁用规则时打断连接',exact=True).press('Space')
 page.get_by_role('button',name=re.compile('规则样式')).click()
 page.get_by_role('option',name='表格',exact=True).click()
 page.locator('[data-slot="modal-close-trigger"]').click()
 page.locator('.rule-table th').first.wait_for()
 assert page.locator('.rule-table th').all_text_contents()==['#','类型','内容','策略组','规则数','命中 / 未命中','状态','操作']
 page.get_by_role('switch',name='启用规则 1',exact=True).locator('xpath=ancestor::*[@data-slot="switch"]//span[@data-slot="switch-control"]').click()
 page.wait_for_timeout(500)
 assert any(call[0]=='mihomoCloseConnection' and call[1]=='a' for call in page.evaluate('window.__calls'))
 assert not any(call[0]=='mihomoCloseConnection' and call[1]=='b' for call in page.evaluate('window.__calls'))
 page.screenshot(path='/tmp/sparkle-rule-table.png')
 page.get_by_role('button',name='规则设置',exact=True).click()
 page.get_by_role('switch',name='显示选中节点',exact=True).press('Space')
 page.get_by_role('button',name=re.compile('规则样式')).click()
 page.get_by_role('option',name='卡片',exact=True).click()
 page.locator('[data-slot="modal-close-trigger"]').click()
 page.locator('.rule-list-row').first.wait_for()
 assert not page.locator('.rule-policy').filter(has_text='Tokyo').count()
 page.evaluate("location.hash='/logs'")
 page.get_by_role('button',name='暂停日志',exact=True).wait_for()
 page.evaluate("for(let i=1;i<=4;i++) window.__emit('mihomoLogs',{type:'info',payload:'日志视图验证-'+i,time:'10:00:00',seq:i})")
 page.get_by_text('日志视图验证-4',exact=True).wait_for()
 page.wait_for_timeout(400)
 page.screenshot(path='/tmp/sparkle-log-cards.png')
 page.get_by_role('button',name='日志设置',exact=True).click()
 page.get_by_role('button',name=re.compile('日志样式')).click()
 page.get_by_role('option',name='表格',exact=True).click()
 page.locator('[data-slot="modal-close-trigger"]').click()
 page.locator('.log-table th').first.wait_for()
 assert page.locator('.log-table th').all_text_contents()==['#','时间','日志等级','内容']
 page.wait_for_timeout(400)
 page.get_by_role('button',name='暂停日志',exact=True).click()
 before=page.locator('.log-table tbody').inner_text()
 page.evaluate("window.__emit('mihomoLogs',{type:'warning',payload:'表格暂停验证',time:'10:00:01',seq:5})")
 page.wait_for_timeout(150)
 assert before==page.locator('.log-table tbody').inner_text(), (before,page.locator('.log-table tbody').inner_text())
 page.get_by_role('button',name='继续日志',exact=True).click()
 page.get_by_text('表格暂停验证',exact=True).wait_for()
 page.screenshot(path='/tmp/sparkle-log-table.png')
 assert not errors,errors
 print('PASS: rule/log settings, layouts, selected-node setting, matching connection closure and table pause',flush=True)
 b.close()
