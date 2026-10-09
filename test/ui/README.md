Build the renderer with `./node_modules/.bin/electron-vite build`, then serve `out/renderer` on localhost (for example, `python3 -m http.server 8765 --bind 127.0.0.1 --directory out/renderer`).

Install Python Playwright and its Chromium browser in your test environment, then run `python3 test/ui/dashboard.py`. Set `SPARKLE_PREVIEW_URL` if the server uses another port. Screenshots are written to `/tmp/sparkle-*.png`.

The harness supplies Electron IPC fixtures and verifies the default home route, live topology expansion and pause, proxy layouts and latency testing, node connectivity, provider placement and health checks, connection filtering and CSV export, usage drill-down, retention confirmation, light/dark themes, and compact layouts. It does not start a real Mihomo process or change system proxy/TUN settings. Main-process usage accounting is tested separately in `test/usage-journal.test.ts`.
