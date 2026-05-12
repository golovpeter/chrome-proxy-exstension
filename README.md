# Chrome Proxy Manager

Manifest V3 Chrome extension for routing browser traffic through HTTP, HTTPS, or SOCKS proxies. The extension uses WXT, React, TypeScript, and Vitest.

## Features

- Full settings dashboard opened as the extension options page.
- Compact popup for quick HTTP/HTTPS/SOCKS mode switching.
- `singleProxy` and per-protocol proxy modes.
- HTTP, HTTPS, SOCKS4, and SOCKS5 proxy configuration.
- Bypass list for `<local>`, CIDR ranges, wildcard domains, hosts, and host ports.
- Proxy authentication through `chrome.webRequest.onAuthRequired`.
- JSON import/export, reset, inline validation, and local credential clearing.

## Commands

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

- `npm run dev`: starts WXT development mode.
- `npm test`: runs Vitest unit tests.
- `npm run typecheck`: checks TypeScript.
- `npm run build`: builds the extension into `.output/chrome-mv3`.

## Install in Chrome

1. Run `npm install`.
2. Run `npm run build`.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click “Load unpacked”.
6. Select `.output/chrome-mv3`.

## Permissions

The extension requests:

- `proxy`: apply fixed proxy settings through `chrome.proxy`.
- `storage`: persist settings and credentials in `chrome.storage.local`.
- `webRequest` and `webRequestAuthProvider`: answer proxy authentication challenges.
- `<all_urls>` host permissions: observe authentication challenges for proxied requests.

## Manifest V3 Limits

The background script is a service worker and can be suspended by Chrome. It reapplies saved settings when started. Credentials are stored locally in extension storage; Chrome extensions do not provide a dedicated OS keychain or hardware-backed secret vault. The connection check is best-effort and uses the currently applied Chrome proxy configuration.
