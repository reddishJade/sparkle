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
        for width in [1200, 850]:
            page.set_viewport_size({'width': width, 'height': 900})
            page.evaluate("location.hash='/home'")
            page.wait_for_timeout(700)
            page.locator('.content').evaluate('(el) => el.scrollTop = 0')
            assert page.locator('.topology-viewport').bounding_box()['height'] <= 232
            sizes = page.locator('.home-bottom > .home-unit').evaluate_all('(cards) => cards.map(card => ({width:card.offsetWidth,height:card.offsetHeight}))')
            assert len(sizes) == 4 and all(size == sizes[0] for size in sizes)
            page.screenshot(path=f'/tmp/sparkle-dense-home-{theme}-{width}.png')
            assert page.locator('.home-bottom > .home-unit').last.locator('.home-unit-row').count() == 4
            page.locator('.home-bottom > .home-unit').last.scroll_into_view_if_needed()
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
            cards = page.locator('.rule-grid-card')
            first, second = cards.nth(0).bounding_box(), cards.nth(1).bounding_box()
            assert (abs(first['y']-second['y']) < 2) == (width == 1200)
            assert page.locator('.rule-grid-card').evaluate_all('(cards) => cards.every(card => card.scrollHeight <= card.clientHeight + 2)')
            page.screenshot(path=f'/tmp/sparkle-dense-rules-{theme}-{width}.png')
            page.locator('.rules-workspace [data-virtuoso-scroller]').evaluate('(el) => el.scrollTop = el.scrollHeight')
            page.get_by_text('Match', exact=True).last.wait_for()
            page.evaluate("location.hash='/proxies'")
            page.get_by_role('button', name='代理提供者', exact=True).click()
            page.get_by_role('button', name='查看节点 (5)', exact=True).click()
            page.get_by_role('button', name='查看节点 (11)', exact=True).click()
            page.wait_for_timeout(400)
            provider_cards = page.locator('.provider-card')
            first, second = provider_cards.nth(0).bounding_box(), provider_cards.nth(1).bounding_box()
            assert (abs(first['y']-second['y']) < 2) == (width == 1200)
            assert page.get_by_role('button', name='健康检查', exact=True).count() == 0
            assert page.get_by_role('button', name='测速', exact=True).count() == 0
            assert page.locator('.provider-node-table tbody tr').count() == 16
            assert page.locator('.provider-node-list').evaluate_all('(lists) => lists.every(list => list.clientHeight <= 280)')
            page.screenshot(path=f'/tmp/sparkle-dense-providers-{theme}-{width}.png')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    print('PASS: dense fixtures, both themes, 1200/850 widths, bounded topology, rules and provider layouts')
    browser.close()
