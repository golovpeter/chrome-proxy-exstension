# Chrome Proxy Extension Design

## Context

This repository starts as an empty project. The extension will be a Manifest V3 Google Chrome extension for routing browser traffic through user-configured HTTP, HTTPS, or SOCKS proxies.

The selected stack is WXT, React, TypeScript, and Vitest. WXT provides Manifest V3 entrypoints for the background service worker, options page, and popup while keeping Vite-compatible development and build behavior.

## Goals

- Provide a full settings dashboard with a compact left navigation rail.
- Let users configure HTTP, HTTPS, and SOCKS proxies with separate host and port fields.
- Support SOCKS4 and SOCKS5.
- Support `singleProxy` and per-protocol proxy modes.
- Persist settings in `chrome.storage.local`.
- Apply proxy settings through `chrome.proxy`.
- Handle proxy authentication through `webRequest.onAuthRequired` and `webRequestAuthProvider`.
- Provide a compact popup for fast status checks, mode switching, disabling proxy, and opening the dashboard.
- Include import/export JSON, reset settings, validation, error states, README documentation, and unit tests for bypass rule parsing.

## Non-Goals

- No dark theme.
- No decorative graphics or marketing-style landing page.
- No remote sync or cloud storage.
- No attempt to provide a true encrypted secret vault, because Chrome extensions do not expose a dedicated keychain-style credential store.

## Architecture

The project will use WXT entrypoints:

- `entrypoints/background.ts` owns Chrome API side effects: applying `chrome.proxy.settings`, clearing proxy settings, handling `webRequest.onAuthRequired`, and responding to runtime messages.
- `entrypoints/options/` contains the dashboard React app.
- `entrypoints/popup/` contains the compact popup React app.

Shared code will live under `src/`:

- `src/core/` contains pure domain code: settings types, validation, bypass rule parsing, import/export schema, and proxy config building.
- `src/platform/` contains Chrome API adapters for storage, proxy, runtime messaging, and auth credentials.
- `src/ui/` contains reusable React UI primitives such as fields, buttons, banners, section shells, and status indicators.

UI code saves settings through platform adapters. The background worker reads persisted settings and applies the generated proxy configuration. This keeps React components free of direct proxy API behavior and makes core logic testable.

## Settings Model

The stored settings will include:

- `enabled`: whether proxy is currently active.
- `activeMode`: quick mode used by the popup, one of `http`, `https`, or `socks`.
- `proxyMode`: `singleProxy` or `perProtocol`.
- `proxies.http`, `proxies.https`, `proxies.socks`: each with `host` and `port`.
- `socksVersion`: `socks4` or `socks5`.
- `bypassListRaw`: comma-separated bypass list from the UI.
- `bypassList`: normalized bypass rules.
- `credentials`: `username` and `password`, stored separately from proxy definitions.
- `lastAppliedAt` and `lastError`: status metadata for UI display.

## Proxy Behavior

When proxy is enabled, the background worker will set Chrome proxy mode to `fixed_servers`.

In `singleProxy` mode, the selected `activeMode` proxy is applied as `singleProxy`.

In `perProtocol` mode:

- HTTP settings map to `proxyForHttp`.
- HTTPS settings map to `proxyForHttps`.
- SOCKS settings map to `fallbackProxy`, so remaining browser traffic can still use SOCKS.

The bypass list maps to Chrome proxy `bypassList`.

Disable proxy clears `chrome.proxy.settings` with regular scope but preserves saved settings. Reset clears settings, credentials, and proxy state.

The connection check will use a best-effort request such as `https://www.google.com/generate_204` with a timeout. The UI and README will state that Chrome does not provide a reliable way for an extension UI to test an arbitrary proxy independently from the currently applied browser proxy settings.

## Authentication Behavior

The manifest will include `webRequest` and `webRequestAuthProvider`. The background worker will listen to `chrome.webRequest.onAuthRequired`.

If credentials exist, the listener returns `authCredentials` so the user is not prompted repeatedly. A per-request retry guard keyed by `requestId` prevents infinite authentication loops. If credentials are missing, the extension does not fabricate credentials and the UI shows a warning.

Credentials are stored in `chrome.storage.local`. The dashboard and README must clearly warn that this is local extension storage, not a hardware-backed or OS keychain-backed secret store.

## Validation

Host validation:

- Required when its proxy entry is active.
- Must not include a URL scheme such as `http://`.
- Must not include a path, query string, or fragment.
- Accepts normal hostnames, IPv4, and practical IPv6 input.

Port validation:

- Required when its proxy entry is active.
- Must be an integer from `1` to `65535`.

Bypass rules:

- Input is comma-separated.
- Whitespace is trimmed.
- Empty entries are ignored.
- Valid examples include `<local>`, `192.168.0.0/16`, `*.example.com`, and `example.com:99`.
- Invalid schemes, paths, malformed CIDR, and invalid ports produce inline validation errors.

Critical validation errors disable Save. Recoverable warnings appear in a status banner or beside the relevant field.

## Dashboard UI

The dashboard will use a light-only enterprise SaaS style: white background, muted gray panels, precise borders, compact spacing, restrained type, and no extra illustration.

The left navigation rail contains:

- “Прокси”
- “Правила”
- “Аутентификация”
- “О расширении”

The “Прокси” section includes proxy mode selection, HTTP/HTTPS/SOCKS host and port fields, SOCKS4/SOCKS5 selector, Save, Check connection, Disable proxy, and current status.

The “Правила” section includes a bypass textarea, examples, hints, validation messages, and normalized preview.

The “Аутентификация” section includes username/password inputs, Clear credentials, and the local-storage warning.

The “О расширении” section includes permissions, Manifest V3 limitations, Export JSON, Import JSON, and Reset settings.

## Popup UI

The popup is intentionally compact and task-focused:

- Active mode selector: HTTP, HTTPS, SOCKS.
- Enabled, disabled, or error status.
- Current proxy `host:port`.
- Disable proxy button.
- Open dashboard button.

The popup persists the last selected mode and asks the background worker to reapply settings when needed.

## Testing

Vitest will cover pure core logic first.

Required tests:

- Bypass parser splits comma-separated input.
- Bypass parser trims whitespace and removes empty entries.
- Bypass parser accepts `<local>`.
- Bypass parser accepts CIDR input such as `192.168.0.0/16`.
- Bypass parser accepts wildcard domains such as `*.example.com`.
- Bypass parser accepts host and port input such as `example.com:99`.
- Bypass parser rejects URL schemes and paths.
- Bypass parser rejects malformed CIDR.
- Bypass parser rejects invalid ports.

Additional tests should cover host/port validation and proxy config building if implementation scope remains reasonable.

## Documentation

`README.md` will document:

- Installation of dependencies.
- Development command.
- Build command.
- Loading the built extension from `.output/chrome-mv3` through `chrome://extensions`.
- Required permissions: `proxy`, `storage`, `webRequest`, `webRequestAuthProvider`.
- Required host permissions for authentication handling.
- Manifest V3 limitations, including service worker lifecycle.
- Credential storage limitations.
- Best-effort nature of connection checks.

`AGENTS.md` will document repository structure, commands, style conventions, testing expectations, and commit/PR guidance.

## Git Checkpoints

Use git from the start:

1. Initialize the repository and commit this design spec.
2. Commit scaffold and tooling.
3. Commit core validation, storage, proxy config tests, and implementation.
4. Commit background proxy and auth behavior.
5. Commit React dashboard and popup.
6. Commit README, AGENTS.md, and final polish.

Commit messages should be concise and conventional, for example `docs: add extension design spec` and `feat: add proxy settings dashboard`.

## Open Questions

No blocking questions remain for the first implementation plan. The design assumes Chrome-first behavior and does not attempt cross-browser support in the first version.
