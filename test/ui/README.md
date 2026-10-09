Build the renderer with `./node_modules/.bin/electron-vite build`, then serve `out/renderer` on localhost (for example, `python3 -m http.server 8765 --bind 127.0.0.1 --directory out/renderer`).

Install Python Playwright and its Chromium browser in your test environment, then run `python3 test/ui/dashboard.py`. Set `SPARKLE_PREVIEW_URL` if the server uses another port. Screenshots are written to `/tmp/sparkle-*.png`.

The harness supplies Electron IPC fixtures and verifies the default home route, live topology expansion and pause, the original Sparkle proxy layout, provider placement and health checks, Geo Data in core settings, the original connection card view, usage drill-down, retention confirmation, light/dark themes, and compact layouts. It does not start a real Mihomo process or change system proxy/TUN settings. Main-process usage accounting is tested separately in `test/usage-journal.test.ts`.

`mihomo-integration.py` instead connects to a real Electron process over CDP and sends actual HTTP traffic through Mihomo. It verifies proxy selection against the controller API, providers, connection cards/closure, usage drill-down, stop/restart notifications, and that core restarts reset current-run usage while retaining historical usage.

Build first and ensure `extra/sidecar/mihomo` exists. Generate a fresh isolated fixture with `node test/ui/prepare-mihomo.cjs`; it prints its temporary directory. With that path assigned to `SPARKLE_TEST_DIR`, run Electron on a local desktop or Xvfb display:

```sh
XDG_CONFIG_HOME="$SPARKLE_TEST_DIR/config" XDG_CACHE_HOME="$SPARKLE_TEST_DIR/cache" DBUS_SESSION_BUS_ADDRESS="unix:path=$SPARKLE_TEST_DIR/no-dbus" node_modules/electron/dist/electron --no-sandbox --disable-gpu --remote-debugging-port=19223 "$SPARKLE_TEST_DIR/launch.cjs"
```

Then run `python3 test/ui/mihomo-integration.py`. Use only the generated fixture: the test changes the selected test proxy, closes connections and stops/restarts its core. Ports 17893, 18081, 19091 and 19223 must be available, and no other Sparkle process may own `/tmp/sparkle-mihomo-external.sock`. System proxy and TUN stay disabled; the DBus address is isolated. The test finishes with its core stopped; close the test Electron process afterwards.
