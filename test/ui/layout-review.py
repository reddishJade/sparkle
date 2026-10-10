from playwright.sync_api import sync_playwright
from pathlib import Path
import os

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--no-proxy-server'])
    page = browser.new_page(viewport={'width': 1200, 'height': 900})
    page.add_init_script(Path(__file__).with_name('dashboard-fixtures.js').read_text() + '\nwindow.__setDenseFixtures();localStorage.setItem("home-service-targets",JSON.stringify(Array.from({length:40},(_,i)=>({name:["YouTube","Netflix","Disney+","OpenAI","Gemini"][i]??"检测项目"+i,url:"https://example.com/service/"+i}))))')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('SPARKLE_PREVIEW_URL', 'http://127.0.0.1:8767'))
    page.wait_for_load_state('networkidle')
    for theme in ['dark', 'light']:
        page.evaluate('(theme) => window.__setTheme(theme)', theme)
        page.wait_for_function('(theme) => document.documentElement.classList.contains(theme)', arg=theme)
        for width in [1456, 1200, 850]:
            page.set_viewport_size({'width': width, 'height': 900})
            page.evaluate("location.hash='/home'")
            page.wait_for_timeout(700)
            page.locator('.content').evaluate('(el) => el.scrollTop = 0')
            assert page.locator('.topology-viewport').bounding_box()['height'] <= 232
            topology_size = page.locator('.topology-viewport').evaluate('(el) => ({clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth})')
            assert topology_size['scrollHeight'] <= topology_size['clientHeight'] + 2, (width, topology_size)
            assert page.locator('.home-traffic-trend').evaluate('(el) => el.scrollHeight <= el.clientHeight + 2')
            sizes = page.locator('.home-widget-body > .home-unit').evaluate_all('(cards) => cards.map(card => ({width:card.offsetWidth,height:card.offsetHeight}))')
            assert len(sizes) == 4 and all(size == sizes[0] for size in sizes)
            assert sizes[0]['height'] <= 208, sizes
            positions = page.locator('.home-widget-body > .home-unit').evaluate_all('(cards) => cards.map(card => Math.round(card.getBoundingClientRect().top))')
            assert len(set(positions)) == 1, positions
            trend = page.locator('[data-home-widget="traffic"]').bounding_box()
            topology = page.locator('[data-home-widget="topology"]').bounding_box()
            assert abs(trend['y']-topology['y']) < 2
            sidebar = page.locator('.sider-cards').bounding_box()
            log_card = page.locator('.log-card').bounding_box()
            assert abs(sidebar['width']-log_card['width']) < 2
            page.screenshot(path=f'/tmp/sparkle-dense-home-{theme}-{width}.png')
            assert page.locator('[data-home-widget="services"] .home-unit-row').count() == 4
            page.locator('[data-home-widget="services"]').scroll_into_view_if_needed()
            page.screenshot(path=f'/tmp/sparkle-dense-bottom-{theme}-{width}.png')
            page.get_by_role('button', name='选择流媒体 AI 检测项目', exact=True).click()
            assert page.locator('.probe-target-row').count() == 40
            page.locator('.probe-target-row').filter(has=page.get_by_role('checkbox', name='展示 Netflix', exact=True)).locator('[data-slot="checkbox-content"]').click()
            assert not page.get_by_role('checkbox', name='展示 Netflix', exact=True).is_checked()
            page.locator('.probe-target-row').filter(has=page.get_by_role('checkbox', name='展示 Disney+', exact=True)).locator('[data-slot="checkbox-content"]').click()
            assert page.get_by_role('checkbox', name='展示 Disney+', exact=True).is_checked()
            page.screenshot(path=f'/tmp/sparkle-dense-detection-dialog-{theme}-{width}.png')
            page.get_by_role('button', name='取消', exact=True).click()
            page.get_by_role('button', name='展开视图', exact=True).click()
            page.get_by_role('button', name='收起视图', exact=True).click()
            page.evaluate("location.hash='/rules'")
            page.get_by_text('emby.yzt.lol', exact=True).wait_for()
            page.wait_for_timeout(300)
            cards = page.locator('.rule-list-row')
            first, second = cards.nth(0).bounding_box(), cards.nth(1).bounding_box()
            identity = cards.first.locator('.rule-identity').bounding_box()
            actions = cards.first.locator('.rule-actions').bounding_box()
            assert identity['x'] < first['x'] + 30 and actions['x'] > first['x'] + first['width'] - 80
            assert first['y'] < second['y'] and abs(first['x']-second['x']) < 2
            assert page.locator('.rule-list-row').evaluate_all('(cards) => cards.every(card => card.scrollHeight <= card.clientHeight + 2)')
            indices = page.locator('.rule-list-row').evaluate_all('(rows) => rows.map(row => Number(row.dataset.ruleIndex) + 1)')
            assert [int(index) for index in indices] == list(range(1, len(indices)+1))
            page.screenshot(path=f'/tmp/sparkle-dense-rules-{theme}-{width}.png')
            before = page.evaluate('window.__calls.filter(call => call[0] === "mihomoRules").length')
            page.get_by_role('button', name='更新规则集 reject', exact=True).click()
            page.wait_for_function('(before) => window.__calls.filter(call => call[0] === "mihomoRules").length > before', arg=before)
            page.locator('.rule-actions').first.hover()
            page.get_by_text('未命中次数', exact=True).wait_for()
            page.get_by_text('最近未命中', exact=True).wait_for()
            page.mouse.move(0, 0)
            page.wait_for_function('''() => {
                const scroller = document.querySelector('.rules-workspace [data-virtuoso-scroller]');
                scroller.scrollTop = scroller.scrollHeight;
                return !!document.querySelector('.rule-list-row[data-rule-index="25"]');
            }''')
            page.locator('.rule-list-row[data-rule-index="25"] .rule-name').wait_for()
            page.evaluate("location.hash='/proxies'")
            page.get_by_role('button', name='代理提供者', exact=True).click()
            page.get_by_role('button', name='查看节点 (5)', exact=True).click()
            page.get_by_role('button', name='查看节点 (11)', exact=True).click()
            page.wait_for_timeout(400)
            provider_cards = page.locator('.provider-card')
            first, second = provider_cards.nth(0).bounding_box(), provider_cards.nth(1).bounding_box()
            assert (abs(first['y']-second['y']) < 2) == (width >= 1200)
            assert page.get_by_role('button', name='健康检查', exact=True).count() == 0
            assert page.get_by_role('button', name='测速', exact=True).count() == 0
            assert page.locator('.provider-node-table tbody tr').count() == 16
            assert page.locator('.provider-node-list').evaluate_all('(lists) => lists.every(list => list.clientHeight <= 280)')
            page.screenshot(path=f'/tmp/sparkle-dense-providers-{theme}-{width}.png')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    print('PASS: dense fixtures, both themes, 1200/850 widths, bounded topology, rules and provider layouts')
    browser.close()
