# Proxy Profiles V2 Design

## Goal

Add first-class saved proxy profiles so a user can store multiple proxy configurations, keep credentials per proxy, and switch the active proxy from the popup with a dropdown.

## Research Notes

Exa MCP was requested for current competitive research on July 6, 2026, but was unavailable during discovery: one query timed out and one failed with an HTTP transport error. Fallback research used public web sources:

- SwitchyOmega README describes the product as managing and switching between multiple proxies quickly.
- SwitchyOmega Profile wiki treats a profile as an applyable proxy mode and distinguishes fixed-server profiles from complex switch/rule profiles.
- FoxyProxy's Chrome guide separates creating a proxy definition from choosing a mode that applies that proxy for all URLs.
- FoxyProxy URL Patterns show that rule-based routing is a larger feature area where every proxy can own its own whitelist/blacklist patterns.

The v2 scope should implement named fixed proxy profiles and quick switching. Rule engines, PAC profiles, pattern routing, subscriptions, and proxy-provider integrations stay out of scope.

## Current Constraints

The extension is currently single-profile end to end:

- `src/core/settings.ts` defines one `ProxySettings`.
- `src/platform/storage.ts` persists one `proxySettings` object and one global `proxyCredentials` object.
- `src/platform/messages.ts` exposes messages that operate on one settings object.
- `entrypoints/background.ts` loads, validates, saves, and applies one settings object.
- `entrypoints/options/App.tsx` edits one settings object.
- `entrypoints/popup/Popup.tsx` switches active protocol modes but has no profile selection.
- `src/core/importExport.ts` exports one settings document without credentials.

## Design

Introduce `ProxyProfilesState` as the canonical persisted v2 state:

```ts
interface ProxyProfilesState {
  version: 2;
  activeProfileId: string;
  profiles: ProxyProfile[];
}

interface ProxyProfile {
  id: string;
  name: string;
  settings: ProfileProxySettings;
  credentials: ProxyCredentials;
  lastAppliedAt?: string;
  lastError?: string;
}
```

`ProfileProxySettings` contains the existing proxy fields without global credentials or runtime status:

- `enabled`
- `activeMode`
- `proxyMode`
- `proxies`
- `socksVersion`
- `bypassListRaw`
- `bypassList`

The active profile is the only profile applied to Chrome. Disabling proxy sets the active profile's `settings.enabled` to `false`, clears Chrome proxy settings, and preserves all profiles.

## Migration

Storage uses a new key, `proxyProfilesState`. `loadProfilesState()` reads this first. If missing, it loads legacy `proxySettings` and `proxyCredentials`, creates a single `Default` profile, and saves v2 state. This preserves current users' data and moves existing credentials into that migrated profile.

The old keys may remain for compatibility; v2 code should not depend on them after migration.

## Runtime API

Replace the UI-facing state with:

```ts
interface ExtensionState {
  profilesState: ProxyProfilesState;
  activeProfile: ProxyProfile;
}
```

Messages should include:

- `GET_STATE`
- `SAVE_PROFILE`
- `CREATE_PROFILE`
- `DUPLICATE_PROFILE`
- `DELETE_PROFILE`
- `SELECT_PROFILE`
- `DISABLE_PROXY`
- `RESET_SETTINGS`
- `CHECK_CONNECTION`

`SAVE_CREDENTIALS` and `CLEAR_CREDENTIALS` become unnecessary because credentials are edited and saved with the profile.

## Options UX

The options page adds a profile management surface in the existing light enterprise style:

- Sidebar navigation stays intact.
- Proxy section gains a compact profile selector/list before the proxy fields.
- Actions: add, duplicate, rename by editing the name field, delete, save, check connection, disable.
- Deleting the last remaining profile is blocked.
- Switching the selected profile edits that profile.
- Saving a profile validates the selected profile, persists it, and applies it if it is the active profile.

The existing Bypass Rules and Authentication sections edit the selected profile's `settings.bypassListRaw` and `credentials`.

## Popup UX

The popup shows:

- Current enabled/error status.
- A `select` dropdown of saved profiles.
- Protocol buttons for HTTP, HTTPS, SOCKS, preserving the current quick mode behavior.
- Disabled and Settings buttons.
- Current proxy summary using the active profile.

Changing the dropdown selects and applies that profile. Protocol buttons update the active profile's `activeMode`, force `singleProxy`, enable it, save it, and apply it.

## Import / Export

Export v2 should serialize all profiles and active profile id without credentials, `lastAppliedAt`, or `lastError`.

Import should accept both:

- Legacy single settings JSON, imported as a single profile named `Imported Profile`.
- V2 profiles JSON, imported as a full profiles state.

Imported profiles receive blank credentials. The UI tells users to re-enter credentials after import.

## Error Handling

- Validation errors stay field-specific where possible.
- Applying a profile stores `lastError` on the active profile only.
- `lastAppliedAt` is stored on the active profile only.
- If `activeProfileId` is missing or invalid, storage normalization selects the first profile.
- If profile list is empty, storage normalization creates a default empty profile.

## Testing

Add focused Vitest coverage for:

- v2 profile helpers and normalization.
- migration from legacy settings and credentials.
- profile validation and active-profile lookup.
- import/export for legacy and v2 formats.
- unchanged proxy config generation for profile settings.

Run:

- `npm test`
- `npm run typecheck`
- `npm run build`

## Out of Scope

- URL rules/pattern routing.
- PAC profiles.
- Sync storage.
- Credential encryption beyond existing `chrome.storage.local` behavior.
- Proxy provider integrations.
