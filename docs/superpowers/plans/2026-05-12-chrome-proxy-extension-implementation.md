# Chrome Proxy Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome proxy manager extension with WXT, React, TypeScript, validated settings, proxy auth handling, popup controls, documentation, and tests.

**Architecture:** WXT entrypoints isolate Chrome extension surfaces: `background` owns Chrome API side effects, `options` owns the full dashboard, and `popup` owns quick controls. Pure logic lives in `src/core` and is covered by Vitest before UI and Chrome adapters consume it.

**Tech Stack:** WXT, React, TypeScript, Vitest, Chrome Extensions Manifest V3 APIs (`chrome.proxy`, `chrome.storage`, `chrome.webRequest.onAuthRequired`).

---

## File Structure

- `package.json`: scripts and dependencies.
- `wxt.config.ts`: WXT manifest configuration and permissions.
- `tsconfig.json`, `vitest.config.ts`: TypeScript and test configuration.
- `entrypoints/background.ts`: background service worker and runtime message handling.
- `entrypoints/options/index.html`, `entrypoints/options/main.tsx`, `entrypoints/options/App.tsx`, `entrypoints/options/options.css`: full dashboard.
- `entrypoints/popup/index.html`, `entrypoints/popup/main.tsx`, `entrypoints/popup/Popup.tsx`, `entrypoints/popup/popup.css`: popup UI.
- `public/icon-16.png`, `public/icon-32.png`, `public/icon-48.png`, `public/icon-128.png`: simple extension icons.
- `src/core/settings.ts`: settings types and defaults.
- `src/core/validation.ts`: host, port, and settings validation.
- `src/core/bypassRules.ts`: bypass parsing and validation.
- `src/core/proxyConfig.ts`: convert settings to `chrome.proxy.ProxyConfig`.
- `src/core/importExport.ts`: JSON import/export validation.
- `src/core/*.test.ts`: Vitest tests for pure logic.
- `src/platform/storage.ts`: `chrome.storage.local` adapter.
- `src/platform/messages.ts`: runtime message types and helpers.
- `src/platform/proxy.ts`: `chrome.proxy` adapter.
- `src/platform/auth.ts`: `webRequest.onAuthRequired` handler.
- `src/ui/components.tsx`: shared React primitives.
- `README.md`: build, install, permissions, limitations.
- `AGENTS.md`: contributor guide.

## Task 1: Scaffold WXT Project

**Files:**
- Create: `package.json`
- Create: `wxt.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `entrypoints/background.ts`
- Create: `entrypoints/options/index.html`
- Create: `entrypoints/options/main.tsx`
- Create: `entrypoints/options/App.tsx`
- Create: `entrypoints/popup/index.html`
- Create: `entrypoints/popup/main.tsx`
- Create: `entrypoints/popup/Popup.tsx`

- [ ] **Step 1: Create npm/WXT configuration**

Create `package.json` with scripts:

```json
{
  "name": "chrome-proxy-extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "react": "latest",
    "react-dom": "latest",
    "wxt": "latest"
  },
  "devDependencies": {
    "@types/chrome": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

Create `wxt.config.ts` with MV3 Chrome permissions:

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Chrome Proxy Manager',
    description: 'Route Chrome traffic through HTTP, HTTPS, or SOCKS proxies.',
    version: '0.1.0',
    manifest_version: 3,
    permissions: ['proxy', 'storage', 'webRequest', 'webRequestAuthProvider'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Proxy Manager',
    },
  },
});
```

Create `tsconfig.json`:

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "types": ["chrome", "vitest/globals"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Create minimal entrypoints**

Create `entrypoints/background.ts`:

```ts
export default defineBackground(() => {
  console.info('Proxy Manager background loaded');
});
```

Create minimal React entrypoints for options and popup that render static placeholders. The placeholders must be replaced by later tasks.

- [ ] **Step 3: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and install exits successfully.

- [ ] **Step 4: Verify scaffold**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: typecheck passes, tests run with no test files or pass once tests exist, and WXT builds `.output/chrome-mv3`.

- [ ] **Step 5: Commit scaffold**

```bash
git add package.json package-lock.json wxt.config.ts tsconfig.json vitest.config.ts entrypoints
git commit -m "chore: scaffold wxt extension"
```

## Task 2: Core Settings and Bypass Rule Parser

**Files:**
- Create: `src/core/settings.ts`
- Create: `src/core/bypassRules.ts`
- Create: `src/core/bypassRules.test.ts`

- [ ] **Step 1: Write failing bypass parser tests**

Create `src/core/bypassRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseBypassRules } from './bypassRules';

describe('parseBypassRules', () => {
  it('splits comma separated rules and trims empty entries', () => {
    expect(parseBypassRules(' <local>,, *.example.com , example.com:99 ').rules).toEqual([
      '<local>',
      '*.example.com',
      'example.com:99',
    ]);
  });

  it('accepts cidr, wildcard domains, host ports, and local token', () => {
    const result = parseBypassRules('<local>, 192.168.0.0/16, *.example.com, example.com:99');
    expect(result.errors).toEqual([]);
    expect(result.rules).toEqual(['<local>', '192.168.0.0/16', '*.example.com', 'example.com:99']);
  });

  it('rejects schemes, paths, invalid cidr, and invalid ports', () => {
    const result = parseBypassRules('https://example.com, example.com/path, 192.168.0.0/99, example.com:70000');
    expect(result.rules).toEqual([]);
    expect(result.errors.map((error) => error.value)).toEqual([
      'https://example.com',
      'example.com/path',
      '192.168.0.0/99',
      'example.com:70000',
    ]);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/core/bypassRules.test.ts
```

Expected: FAIL because `src/core/bypassRules.ts` does not exist.

- [ ] **Step 3: Implement settings types and parser**

Create `src/core/settings.ts` with proxy mode, active mode, SOCKS version, proxy endpoint, credentials, and settings interfaces plus `DEFAULT_SETTINGS`.

Create `src/core/bypassRules.ts` exporting `parseBypassRules(raw: string): { rules: string[]; errors: BypassRuleError[] }`. It must accept `<local>`, CIDR with prefix `0..32`, wildcard domains beginning `*.`, plain hosts, IPv4, IPv6-like bracketless strings, and optional `:port` where port is `1..65535`. It must reject schemes, paths, malformed CIDR, and invalid ports.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- src/core/bypassRules.test.ts
npm run typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 5: Commit core parser**

```bash
git add src/core/settings.ts src/core/bypassRules.ts src/core/bypassRules.test.ts
git commit -m "feat: add bypass rule parser"
```

## Task 3: Core Validation and Proxy Config Builder

**Files:**
- Create: `src/core/validation.ts`
- Create: `src/core/validation.test.ts`
- Create: `src/core/proxyConfig.ts`
- Create: `src/core/proxyConfig.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create tests for host/port validation:

```ts
import { describe, expect, it } from 'vitest';
import { validateHost, validatePort } from './validation';

describe('validateHost', () => {
  it('rejects empty hosts, schemes, and paths', () => {
    expect(validateHost('').valid).toBe(false);
    expect(validateHost('http://proxy.example.com').valid).toBe(false);
    expect(validateHost('proxy.example.com/path').valid).toBe(false);
  });

  it('accepts domain names and ip addresses', () => {
    expect(validateHost('proxy.example.com').valid).toBe(true);
    expect(validateHost('192.168.1.10').valid).toBe(true);
    expect(validateHost('2001:db8::1').valid).toBe(true);
  });
});

describe('validatePort', () => {
  it('accepts only integer ports from 1 to 65535', () => {
    expect(validatePort('1').valid).toBe(true);
    expect(validatePort('65535').valid).toBe(true);
    expect(validatePort('0').valid).toBe(false);
    expect(validatePort('65536').valid).toBe(false);
    expect(validatePort('abc').valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run validation tests and verify RED**

Run:

```bash
npm test -- src/core/validation.test.ts
```

Expected: FAIL because `validation.ts` does not exist.

- [ ] **Step 3: Implement validation**

Implement `validateHost`, `validatePort`, and `validateSettings` in `src/core/validation.ts` with typed validation results and user-facing messages.

- [ ] **Step 4: Verify validation GREEN**

Run:

```bash
npm test -- src/core/validation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing proxy config tests**

Create `src/core/proxyConfig.test.ts` with tests that assert `singleProxy` uses `activeMode`, `perProtocol` maps HTTP/HTTPS/SOCKS to `proxyForHttp`, `proxyForHttps`, and `fallbackProxy`, and disabled settings return `null`.

- [ ] **Step 6: Run proxy config tests and verify RED**

Run:

```bash
npm test -- src/core/proxyConfig.test.ts
```

Expected: FAIL because `proxyConfig.ts` does not exist.

- [ ] **Step 7: Implement proxy config builder**

Create `src/core/proxyConfig.ts` exporting `buildProxyConfig(settings: ProxySettings): chrome.proxy.ProxyConfig | null`.

- [ ] **Step 8: Verify core GREEN**

Run:

```bash
npm test
npm run typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 9: Commit validation and config builder**

```bash
git add src/core/validation.ts src/core/validation.test.ts src/core/proxyConfig.ts src/core/proxyConfig.test.ts
git commit -m "feat: add proxy validation and config builder"
```

## Task 4: Storage, Import/Export, Proxy, and Auth Platform Adapters

**Files:**
- Create: `src/core/importExport.ts`
- Create: `src/core/importExport.test.ts`
- Create: `src/platform/storage.ts`
- Create: `src/platform/proxy.ts`
- Create: `src/platform/auth.ts`
- Create: `src/platform/messages.ts`
- Modify: `entrypoints/background.ts`

- [ ] **Step 1: Write failing import/export tests**

Create tests that export settings to pretty JSON, import valid JSON, reject malformed JSON, reject settings with invalid ports, and do not require credentials in exported settings.

- [ ] **Step 2: Run import/export tests and verify RED**

Run:

```bash
npm test -- src/core/importExport.test.ts
```

Expected: FAIL because `importExport.ts` does not exist.

- [ ] **Step 3: Implement import/export**

Implement `exportSettings(settings)` and `importSettings(json)` using existing validation and defaults.

- [ ] **Step 4: Implement Chrome adapters**

Implement:

- `loadSettings`, `saveSettings`, `resetSettings`, `loadCredentials`, `saveCredentials`, `clearCredentials` in `src/platform/storage.ts`.
- `applyProxySettings`, `clearProxySettings`, `checkConnection` in `src/platform/proxy.ts`.
- `registerAuthHandler` in `src/platform/auth.ts` with request retry guard.
- Runtime message types and `sendMessage` helper in `src/platform/messages.ts`.

- [ ] **Step 5: Wire background**

Modify `entrypoints/background.ts` so it registers auth handling, applies settings on install/startup, and handles messages: `GET_STATE`, `SAVE_SETTINGS`, `APPLY_SETTINGS`, `DISABLE_PROXY`, `RESET_SETTINGS`, `CHECK_CONNECTION`, `SAVE_CREDENTIALS`, `CLEAR_CREDENTIALS`.

- [ ] **Step 6: Verify platform work**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all pass and build emits `.output/chrome-mv3`.

- [ ] **Step 7: Commit platform adapters**

```bash
git add src/core/importExport.ts src/core/importExport.test.ts src/platform entrypoints/background.ts
git commit -m "feat: add proxy storage and background adapters"
```

## Task 5: Dashboard UI

**Files:**
- Modify: `entrypoints/options/App.tsx`
- Create: `entrypoints/options/options.css`
- Create: `src/ui/components.tsx`
- Modify: `entrypoints/options/main.tsx`

- [ ] **Step 1: Implement shared UI primitives**

Create typed React components for `Field`, `Button`, `SegmentedControl`, `StatusBanner`, `SectionHeader`, and `TextAreaField` in `src/ui/components.tsx`.

- [ ] **Step 2: Build dashboard shell**

Modify options app to use left navigation with sections: “Прокси”, “Правила”, “Аутентификация”, “О расширении”. Keep the design light-only with white surfaces, gray cards, clear spacing, and no decorative graphics.

- [ ] **Step 3: Build Proxy section**

Add fields for HTTP, HTTPS, and SOCKS host/port, SOCKS4/SOCKS5 selector, proxy mode selector, Save, Check connection, Disable proxy, inline validation, and status banner.

- [ ] **Step 4: Build Rules section**

Add bypass textarea, examples `<local>, 192.168.0.0/16, *.example.com, example.com:99`, validation messages, and normalized preview.

- [ ] **Step 5: Build Authentication section**

Add username/password fields, local storage warning, Save credentials behavior, and Clear credentials button.

- [ ] **Step 6: Build About section**

Add permissions summary, MV3 limitations, Export JSON, Import JSON file input, and Reset settings.

- [ ] **Step 7: Verify dashboard**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 8: Commit dashboard**

```bash
git add entrypoints/options src/ui
git commit -m "feat: add settings dashboard"
```

## Task 6: Popup UI

**Files:**
- Modify: `entrypoints/popup/Popup.tsx`
- Create: `entrypoints/popup/popup.css`
- Modify: `entrypoints/popup/main.tsx`

- [ ] **Step 1: Build compact popup**

Add active mode segmented control for HTTP/HTTPS/SOCKS, enabled/error status, current `host:port`, Disable proxy button, and Open dashboard button.

- [ ] **Step 2: Wire popup messages**

Load state through `GET_STATE`, persist active mode through `SAVE_SETTINGS`, apply settings after mode changes, disable through `DISABLE_PROXY`, and open dashboard via `chrome.runtime.openOptionsPage()`.

- [ ] **Step 3: Verify popup**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 4: Commit popup**

```bash
git add entrypoints/popup
git commit -m "feat: add proxy popup controls"
```

## Task 7: Docs, Contributor Guide, Icons, and Final Verification

**Files:**
- Create: `README.md`
- Create: `AGENTS.md`
- Create: `public/icon-16.png`
- Create: `public/icon-32.png`
- Create: `public/icon-48.png`
- Create: `public/icon-128.png`
- Modify: `wxt.config.ts`

- [ ] **Step 1: Add simple extension icons**

Create minimal light-theme PNG icons and reference them through WXT public assets.

- [ ] **Step 2: Write README**

Document dependency install, `npm run dev`, `npm run build`, loading `.output/chrome-mv3` through `chrome://extensions`, required permissions, auth behavior, MV3 service worker limitations, local credential storage limitations, and best-effort connection checking.

- [ ] **Step 3: Write AGENTS.md**

Title it “Repository Guidelines”. Include structure, commands, style, testing, commit guidance, and security/configuration notes specific to this extension.

- [ ] **Step 4: Final verification**

Run:

```bash
npm test
npm run typecheck
npm run build
git status --short
```

Expected: tests pass, typecheck passes, build succeeds, and only intentional final docs/icon changes are present before commit.

- [ ] **Step 5: Commit docs and final polish**

```bash
git add README.md AGENTS.md public wxt.config.ts
git commit -m "docs: add usage and contributor guides"
```

## Self-Review

- Spec coverage: the plan covers WXT scaffold, MV3 permissions, core validation, bypass tests, proxy config, storage, background proxy/auth behavior, dashboard, popup, README, AGENTS.md, and git checkpoints.
- Placeholder scan: no task relies on `TBD` or unspecified ownership. Some implementation steps intentionally describe file responsibilities instead of full final source because the exact code will be produced through TDD during execution.
- Type consistency: settings names match the design spec: `enabled`, `activeMode`, `proxyMode`, `proxies`, `socksVersion`, `bypassListRaw`, `bypassList`, `credentials`, `lastAppliedAt`, and `lastError`.
