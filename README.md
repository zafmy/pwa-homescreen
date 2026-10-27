# pwa-homescreen

A gold (XAUUSD) trading demo that installs to the phone home screen as a PWA, with no app store. The landing page works out which device and browser the visitor has and opens the matching "Add to Home Screen" steps.

Plain HTML, CSS and ES modules: no framework, no build step, no dependencies.

> **Demo only.** Prices are simulated by a random walk in [`js/price.js`](js/price.js). They are not market data, and nothing here places real trades.

## What's inside

| Page | What it does |
|---|---|
| `index.html` | Landing page: animated hero, live demo embedded in a phone frame, and the install guide |
| `app.html` | The installable app: Home, Chart, Trade, Analysis and More tabs |

- **Install guide per device.** [`js/detect.js`](js/detect.js) sorts visitors into iOS Safari, iOS in-app/other browsers, Android Chrome, Edge or Samsung Internet, desktop Chromium, other desktops, or already installed. On Chromium it uses the native `beforeinstallprompt`. On iOS it shows the Share → Add to Home Screen steps, and tells in-app browser users to open the page in Safari first.
- **Demo account.** $10,000 of demo funds, market and pending orders, SL/TP, margin and P&L in [`js/demo.js`](js/demo.js), pure logic that returns a new state on every call. [`js/app.js`](js/app.js) saves it only in the browser's `localStorage`.
- **Offline.** [`sw.js`](sw.js) precaches the app shell and is network-first, so online users always get the latest build.

## Run locally

Any static server works. Service workers need `http://localhost` or HTTPS.

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>. To try the install flow on a phone, serve it over HTTPS (for example through a tunnel) and open it in Safari on iOS or Chrome on Android.

### Docker

```bash
docker build -t pwa-homescreen .
docker run --rm -p 8080:80 pwa-homescreen
```

The image is `nginx:1.27-alpine` with [`nginx.conf`](nginx.conf), which sets `no-cache` on `sw.js`, the manifest and the HTML so installed users never get stuck on an old version.

## Tests

Platform detection and the demo-account maths are tested with Node's built-in runner (Node 20+):

```bash
node --test test/
```

## License

[MIT](LICENSE)
