# Proxy Profiles V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add saved proxy profiles with per-profile credentials and quick popup switching.

**Architecture:** Introduce a v2 `ProxyProfilesState` as the canonical storage contract while preserving `ProxySettings`-compatible proxy config generation. The background applies only the active profile; options edits selected profiles; popup switches the active profile via dropdown.

**Tech Stack:** WXT Manifest V3, TypeScript, React, Chrome extension APIs, Vitest.

---

## Global Constraints

- Keep public Chrome permissions unchanged.
- Keep credentials in `chrome.storage.local`, never include credentials in exported JSON, and never log credentials.
- Preserve existing proxy behavior for one migrated profile.
- Keep UI light-only and enterprise-focused: white surfaces, gray panels, compact spacing, clear validation states.
- Do not add rules-engine, PAC profile, sync storage, provider integrations, or credential encryption in this version.
- Runtime source of truth is v2 `ProxyProfilesState`.
- Legacy `proxySettings` plus `proxyCredentials` must migrate into one profile named `Default`.

## File Structure

- Modify `src/core/settings.ts`: add profile types, default profile settings, profile factory/normalization helpers.
- Create `src/core/profiles.test.ts`: cover profile helpers and normalization.
- Modify `src/core/validation.ts`: validate profile settings without relying on credentials embedded in settings.
- Modify `src/platform/storage.ts`: add v2 state load/save/migration functions and keep legacy helper compatibility only where useful.
- Create `src/platform/storage.test.ts`: test migration with mocked `chrome.storage.local`.
- Modify `src/platform/messages.ts`: expose v2 runtime messages and state.
- Modify `entrypoints/background.ts`: apply/save/select profiles.
- Modify `src/platform/auth.ts`: resolve credentials from active profile.
- Modify `src/core/importExport.ts`: export/import v2 profiles and legacy settings.
- Modify `src/core/importExport.test.ts`: cover v2 export/import and legacy import.
- Modify `entrypoints/options/App.tsx`: profile-aware editor.
- Modify `entrypoints/popup/Popup.tsx`: profile dropdown and active profile summary.
- Modify nearby CSS files under `entrypoints/options` and `entrypoints/popup` if required by the UI changes.

## Task 1: Core Profile Model

**Files:**
- Modify: `src/core/settings.ts`
- Modify: `src/core/validation.ts`
- Create: `src/core/profiles.test.ts`

- [ ] **Step 1: Add tests for profile creation and normalization**

Create `src/core/profiles.test.ts` with tests that assert:

```ts
import { describe, expect, it } from 'vitest';
import {
  createDefaultProfile,
  createProfilesState,
  DEFAULT_PROFILE_SETTINGS,
  normalizeProfilesState,
  type ProxyProfilesState,
} from './settings';

describe('profile settings helpers', () => {
  it('creates a default profile with per-profile credentials', () => {
    const profile = createDefaultProfile('Work');

    expect(profile.name).toBe('Work');
    expect(profile.settings).toEqual(DEFAULT_PROFILE_SETTINGS);
    expect(profile.credentials).toEqual({ username: '', password: '' });
    expect(profile.id).toMatch(/^profile-/);
  });

  it('creates a profiles state with the first profile active', () => {
    const state = createProfilesState([createDefaultProfile('A'), createDefaultProfile('B')]);

    expect(state.version).toBe(2);
    expect(state.activeProfileId).toBe(state.profiles[0].id);
    expect(state.profiles).toHaveLength(2);
  });

  it('normalizes an empty state into one default profile', () => {
    const state = normalizeProfilesState({ version: 2, activeProfileId: 'missing', profiles: [] });

    expect(state.profiles).toHaveLength(1);
    expect(state.activeProfileId).toBe(state.profiles[0].id);
    expect(state.profiles[0].name).toBe('Default');
  });

  it('selects the first profile when activeProfileId is invalid', () => {
    const profile = createDefaultProfile('Only');
    const state = normalizeProfilesState({ version: 2, activeProfileId: 'missing', profiles: [profile] });

    expect(state.activeProfileId).toBe(profile.id);
  });

  it('fills missing profile fields without overwriting valid values', () => {
    const partial = {
      version: 2,
      activeProfileId: 'profile-custom',
      profiles: [
        {
          id: 'profile-custom',
          name: 'Custom',
          settings: {
            enabled: true,
            activeMode: 'socks',
            proxyMode: 'singleProxy',
            proxies: {
              http: { host: '', port: '' },
              https: { host: '', port: '' },
              socks: { host: '127.0.0.1', port: '9050' },
            },
            socksVersion: 'socks5',
            bypassListRaw: '<local>',
            bypassList: ['<local>'],
          },
          credentials: { username: 'user', password: 'pass' },
        },
      ],
    } satisfies ProxyProfilesState;

    const state = normalizeProfilesState(partial);

    expect(state.profiles[0].settings.proxies.socks).toEqual({ host: '127.0.0.1', port: '9050' });
    expect(state.profiles[0].credentials).toEqual({ username: 'user', password: 'pass' });
  });
});
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `npm test -- src/core/profiles.test.ts`

Expected: FAIL because profile helpers are not defined.

- [ ] **Step 3: Implement profile types and helpers**

In `src/core/settings.ts`, keep existing exported types where possible and add:

```ts
export type ProfileProxySettings = Omit<ProxySettings, 'credentials' | 'lastAppliedAt' | 'lastError'>;

export interface ProxyProfile {
  id: string;
  name: string;
  settings: ProfileProxySettings;
  credentials: ProxyCredentials;
  lastAppliedAt?: string;
  lastError?: string;
}

export interface ProxyProfilesState {
  version: 2;
  activeProfileId: string;
  profiles: ProxyProfile[];
}

export const DEFAULT_PROFILE_SETTINGS: ProfileProxySettings = {
  enabled: DEFAULT_SETTINGS.enabled,
  activeMode: DEFAULT_SETTINGS.activeMode,
  proxyMode: DEFAULT_SETTINGS.proxyMode,
  proxies: DEFAULT_SETTINGS.proxies,
  socksVersion: DEFAULT_SETTINGS.socksVersion,
  bypassListRaw: DEFAULT_SETTINGS.bypassListRaw,
  bypassList: DEFAULT_SETTINGS.bypassList,
};

export function createProfileId(): string {
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultProfile(name = 'Default'): ProxyProfile {
  return {
    id: createProfileId(),
    name,
    settings: cloneProfileSettings(DEFAULT_PROFILE_SETTINGS),
    credentials: { ...DEFAULT_SETTINGS.credentials },
  };
}

export function createProfilesState(profiles = [createDefaultProfile()]): ProxyProfilesState {
  const normalizedProfiles = profiles.length ? profiles : [createDefaultProfile()];

  return normalizeProfilesState({
    version: 2,
    activeProfileId: normalizedProfiles[0].id,
    profiles: normalizedProfiles,
  });
}

export function normalizeProfilesState(state: ProxyProfilesState): ProxyProfilesState {
  const profiles = state.profiles.length ? state.profiles.map(normalizeProfile) : [createDefaultProfile()];
  const activeProfileId = profiles.some((profile) => profile.id === state.activeProfileId)
    ? state.activeProfileId
    : profiles[0].id;

  return {
    version: 2,
    activeProfileId,
    profiles,
  };
}

export function normalizeProfile(profile: ProxyProfile): ProxyProfile {
  return {
    ...profile,
    id: profile.id || createProfileId(),
    name: profile.name?.trim() || 'Untitled Profile',
    settings: normalizeProfileSettings(profile.settings),
    credentials: {
      ...DEFAULT_SETTINGS.credentials,
      ...profile.credentials,
    },
  };
}

export function normalizeProfileSettings(settings: Partial<ProfileProxySettings> = {}): ProfileProxySettings {
  return {
    ...DEFAULT_PROFILE_SETTINGS,
    ...settings,
    proxies: {
      http: { ...DEFAULT_PROFILE_SETTINGS.proxies.http, ...settings.proxies?.http },
      https: { ...DEFAULT_PROFILE_SETTINGS.proxies.https, ...settings.proxies?.https },
      socks: { ...DEFAULT_PROFILE_SETTINGS.proxies.socks, ...settings.proxies?.socks },
    },
    bypassList: settings.bypassList ?? DEFAULT_PROFILE_SETTINGS.bypassList,
  };
}

export function profileToSettings(profile: ProxyProfile): ProxySettings {
  return {
    ...profile.settings,
    credentials: profile.credentials,
    lastAppliedAt: profile.lastAppliedAt,
    lastError: profile.lastError,
  };
}

export function settingsToProfile(settings: ProxySettings, name = 'Default'): ProxyProfile {
  const { credentials, lastAppliedAt, lastError, ...profileSettings } = settings;

  return {
    id: createProfileId(),
    name,
    settings: normalizeProfileSettings(profileSettings),
    credentials: { ...credentials },
    lastAppliedAt,
    lastError,
  };
}

function cloneProfileSettings(settings: ProfileProxySettings): ProfileProxySettings {
  return {
    ...settings,
    proxies: {
      http: { ...settings.proxies.http },
      https: { ...settings.proxies.https },
      socks: { ...settings.proxies.socks },
    },
    bypassList: [...settings.bypassList],
  };
}
```

Adjust `validateSettings` in `src/core/validation.ts` to continue accepting `ProxySettings` and add:

```ts
import type { ProfileProxySettings } from './settings';

export function validateProfileSettings(settings: ProfileProxySettings): SettingsValidationResult {
  // same logic as validateSettings, but without credentials warning
}
```

Then implement `validateSettings(settings: ProxySettings)` by calling `validateProfileSettings(settings)` and appending the existing credentials warning.

- [ ] **Step 4: Run focused core tests**

Run: `npm test -- src/core/profiles.test.ts src/core/validation.test.ts src/core/proxyConfig.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/core/settings.ts src/core/validation.ts src/core/profiles.test.ts
git commit -m "feat: add proxy profile model"
```

## Task 2: V2 Storage And Migration

**Files:**
- Modify: `src/platform/storage.ts`
- Create: `src/platform/storage.test.ts`

- [ ] **Step 1: Add storage migration tests**

Create `src/platform/storage.test.ts` with a mocked `chrome.storage.local` that covers:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/settings';
import { loadProfilesState, saveProfilesState } from './storage';

const store: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }

  vi.stubGlobal('chrome', {
    runtime: { lastError: undefined },
    storage: {
      local: {
        get: (keys: string | string[], callback: (items: Record<string, unknown>) => void) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          callback(Object.fromEntries(keyList.map((key) => [key, store[key]])));
        },
        set: (items: Record<string, unknown>, callback: () => void) => {
          Object.assign(store, items);
          callback();
        },
      },
    },
  });
});

describe('profile storage', () => {
  it('loads existing v2 profiles state', async () => {
    await saveProfilesState({
      version: 2,
      activeProfileId: 'profile-a',
      profiles: [
        {
          id: 'profile-a',
          name: 'A',
          settings: {
            enabled: false,
            activeMode: 'http',
            proxyMode: 'singleProxy',
            proxies: DEFAULT_SETTINGS.proxies,
            socksVersion: 'socks5',
            bypassListRaw: '<local>',
            bypassList: ['<local>'],
          },
          credentials: { username: '', password: '' },
        },
      ],
    });

    const state = await loadProfilesState();

    expect(state.activeProfileId).toBe('profile-a');
    expect(state.profiles[0].name).toBe('A');
  });

  it('migrates legacy settings and credentials into a default profile', async () => {
    store.proxySettings = {
      ...DEFAULT_SETTINGS,
      enabled: true,
      activeMode: 'http',
      proxies: {
        ...DEFAULT_SETTINGS.proxies,
        http: { host: 'proxy.example.com', port: '8080' },
      },
      credentials: undefined,
    };
    store.proxyCredentials = { username: 'legacy-user', password: 'legacy-pass' };

    const state = await loadProfilesState();

    expect(state.version).toBe(2);
    expect(state.profiles).toHaveLength(1);
    expect(state.profiles[0].name).toBe('Default');
    expect(state.profiles[0].settings.proxies.http.host).toBe('proxy.example.com');
    expect(state.profiles[0].credentials).toEqual({ username: 'legacy-user', password: 'legacy-pass' });
    expect(store.proxyProfilesState).toEqual(state);
  });
});
```

- [ ] **Step 2: Run storage tests and verify they fail**

Run: `npm test -- src/platform/storage.test.ts`

Expected: FAIL because v2 storage functions do not exist.

- [ ] **Step 3: Implement v2 storage**

In `src/platform/storage.ts`:

- Add `PROFILES_STATE_KEY = 'proxyProfilesState'`.
- Add `loadProfilesState()`, `saveProfilesState(state)`, `resetProfilesState()`, `getActiveProfile(state)`, `saveProfile(profile)`, and `selectProfile(profileId)`.
- Keep legacy `loadSettings()` by returning `profileToSettings(getActiveProfile(await loadProfilesState()))` so older call sites can be migrated safely.
- Implement migration by reading legacy keys when v2 state is absent.

- [ ] **Step 4: Run storage and core tests**

Run: `npm test -- src/platform/storage.test.ts src/core/profiles.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/platform/storage.ts src/platform/storage.test.ts
git commit -m "feat: migrate storage to proxy profiles"
```

## Task 3: Background Runtime And Auth

**Files:**
- Modify: `src/platform/messages.ts`
- Modify: `entrypoints/background.ts`
- Modify: `src/platform/auth.ts`

- [ ] **Step 1: Update runtime contracts**

In `src/platform/messages.ts`, change `ExtensionState` to include `profilesState` and `activeProfile`. Add message types for `SAVE_PROFILE`, `CREATE_PROFILE`, `DUPLICATE_PROFILE`, `DELETE_PROFILE`, and `SELECT_PROFILE`. Remove credential-only messages from active UI use.

- [ ] **Step 2: Update auth credential lookup**

In `src/platform/auth.ts`, resolve credentials from the active profile via `loadProfilesState()` and `getActiveProfile()`.

- [ ] **Step 3: Update background message handling**

In `entrypoints/background.ts`:

- `GET_STATE` returns profiles state plus active profile.
- `SAVE_PROFILE` parses bypass rules for that profile, validates with `validateProfileSettings`, persists it, applies if active, and returns fresh state.
- `SELECT_PROFILE` sets `activeProfileId`, applies the newly active profile if enabled, clears proxy if disabled, and returns fresh state.
- `CREATE_PROFILE` creates a profile and selects it.
- `DUPLICATE_PROFILE` clones a profile with blank `lastAppliedAt` and `lastError`, names it `"<source name> Copy"`, and selects it.
- `DELETE_PROFILE` blocks deletion when only one profile remains, otherwise removes the profile and selects a valid remaining profile.
- `DISABLE_PROXY` disables the active profile only.
- `RESET_SETTINGS` resets v2 profiles state and clears Chrome proxy settings.
- `CHECK_CONNECTION` stays unchanged.

- [ ] **Step 4: Typecheck runtime changes**

Run: `npm run typecheck`

Expected: PASS or only UI compile errors from not-yet-updated React call sites. If UI errors appear, record them in the task report and continue to Task 4.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/platform/messages.ts entrypoints/background.ts src/platform/auth.ts
git commit -m "feat: apply active proxy profiles"
```

## Task 4: Import Export V2

**Files:**
- Modify: `src/core/importExport.ts`
- Modify: `src/core/importExport.test.ts`

- [ ] **Step 1: Add import/export tests**

Update `src/core/importExport.test.ts` to assert:

- Export of v2 state includes `version`, `activeProfileId`, and `profiles`.
- Export excludes credentials and runtime errors.
- Import of v2 JSON returns a normalized `ProxyProfilesState` with blank credentials.
- Import of legacy single-settings JSON returns one profile named `Imported Profile`.

- [ ] **Step 2: Run import/export tests and verify they fail**

Run: `npm test -- src/core/importExport.test.ts`

Expected: FAIL because v2 import/export is not implemented.

- [ ] **Step 3: Implement v2 import/export**

In `src/core/importExport.ts`:

- Change exported result to return `ProxyProfilesState`.
- Add `exportProfilesState(state: ProxyProfilesState): string`.
- Add `importProfilesState(json: string): ImportProfilesResult`.
- Preserve wrapper names `exportSettings` and `importSettings` only if needed by existing call sites, but make UI use the v2 names.
- Strip credentials and runtime fields from every exported profile.
- Detect legacy settings JSON by presence of `proxies` and absence of `profiles`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/core/importExport.test.ts src/core/profiles.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/core/importExport.ts src/core/importExport.test.ts
git commit -m "feat: export proxy profiles"
```

## Task 5: Options Profile UI

**Files:**
- Modify: `entrypoints/options/App.tsx`
- Modify: `entrypoints/options/style.css` or the actual options CSS file if named differently

- [ ] **Step 1: Convert options state to profiles**

Load `ExtensionState`, keep `profilesState` and derive `activeProfile`. Add local selected profile state by id. Edits update the selected profile object, not a global `ProxySettings`.

- [ ] **Step 2: Add profile controls**

Add controls in the Proxy section:

- select/list of profiles
- name field
- Add
- Duplicate
- Delete
- Save

Delete button is disabled when only one profile exists. Save validates selected profile. Status messages should mention profile names.

- [ ] **Step 3: Make proxy, rules, and auth sections profile-aware**

Proxy fields edit `selectedProfile.settings.proxies`. Bypass rules edit `selectedProfile.settings.bypassListRaw`. Authentication edits `selectedProfile.credentials`. Remove separate save/clear credential runtime messages; clearing credentials sets selected profile credentials to blank and saves that profile.

- [ ] **Step 4: Wire import/export/reset**

Use `exportProfilesState(profilesState)` and `importProfilesState(fileText)`. After import, save/select via runtime and show a warning-style status that credentials are not imported.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS or only popup compile errors from Task 6 not being done yet.

- [ ] **Step 6: Commit**

Run:

```bash
git add entrypoints/options/App.tsx entrypoints/options/style.css
git commit -m "feat: manage proxy profiles in options"
```

## Task 6: Popup Profile Switcher

**Files:**
- Modify: `entrypoints/popup/Popup.tsx`
- Modify: `entrypoints/popup/style.css` or the actual popup CSS file if named differently

- [ ] **Step 1: Convert popup state to profiles**

Load `ExtensionState`, render active profile status, and summarize active profile endpoint.

- [ ] **Step 2: Add profile dropdown**

Add a `<select>` containing all profiles. Changing it sends `SELECT_PROFILE` with the chosen profile id. Disable it while busy or while no settings are loaded.

- [ ] **Step 3: Preserve quick protocol buttons**

HTTP/HTTPS/SOCKS buttons update the active profile's `settings.activeMode`, set `settings.proxyMode` to `singleProxy`, set `settings.enabled` to `true`, then send `SAVE_PROFILE`.

- [ ] **Step 4: Keep disabled/settings actions**

Disabled sends `DISABLE_PROXY`. Settings opens options page. Error display uses active profile `lastError`.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add entrypoints/popup/Popup.tsx entrypoints/popup/style.css
git commit -m "feat: switch proxy profiles from popup"
```

## Task 7: Final Verification

**Files:**
- Modify tests only if final verification reveals a focused regression.

- [ ] **Step 1: Run full unit tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS and `.output/chrome-mv3` is produced.

- [ ] **Step 4: Inspect final git status**

Run: `git status --short`

Expected: only intentional source, test, spec, and plan changes are present.

- [ ] **Step 5: Commit final fixes if any**

If verification required changes, commit them:

```bash
git add <changed-files>
git commit -m "fix: stabilize proxy profiles"
```

## Self-Review

- Spec coverage: profile model, migration, runtime, options, popup, import/export, validation, and verification are covered.
- Placeholder scan: no TBD/TODO placeholders are used as requirements.
- Type consistency: `ProxyProfilesState`, `ProxyProfile`, `ProfileProxySettings`, and runtime message names are consistent across tasks.
