import { describe, expect, it } from 'vitest';
import { exportProfilesState, importProfilesState } from './importExport';
import {
  createDefaultProfile,
  normalizeProfilesState,
  type ProxyProfile,
  type ProxyProfilesState,
} from './settings';

function buildProfile(overrides: Partial<ProxyProfile> = {}): ProxyProfile {
  return {
    ...createDefaultProfile('Work'),
    id: 'profile-work',
    settings: {
      enabled: true,
      activeMode: 'http',
      proxyMode: 'perProtocol',
      proxies: {
        http: { host: 'http.proxy.local', port: '8080' },
        https: { host: 'https.proxy.local', port: '8443' },
        socks: { host: 'socks.proxy.local', port: '1080' },
      },
      socksVersion: 'socks5',
      bypassListRaw: '<local>, *.example.com',
      bypassList: ['<local>', '*.example.com'],
    },
    credentials: { username: 'user', password: 'secret' },
    lastAppliedAt: '2026-07-06T10:00:00.000Z',
    lastError: 'Could not connect.',
    ...overrides,
  };
}

describe('profiles import/export', () => {
  it('exports v2 state without credentials or runtime fields', () => {
    const state: ProxyProfilesState = {
      version: 2,
      activeProfileId: 'profile-work',
      profiles: [buildProfile()],
    };

    const json = exportProfilesState(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const profile = (parsed.profiles as Array<Record<string, unknown>>)[0]!;

    expect(parsed.version).toBe(2);
    expect(parsed.activeProfileId).toBe('profile-work');
    expect(Array.isArray(parsed.profiles)).toBe(true);
    expect(profile.credentials).toBeUndefined();
    expect(profile.lastAppliedAt).toBeUndefined();
    expect(profile.lastError).toBeUndefined();
  });

  it('imports v2 json into a normalized state with blank credentials', () => {
    const result = importProfilesState(
      JSON.stringify({
        version: 2,
        activeProfileId: 'profile-imported',
        profiles: [
          buildProfile({
            id: 'profile-imported',
            name: '  Imported Work  ',
          }),
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual(
        normalizeProfilesState({
          version: 2,
          activeProfileId: 'profile-imported',
          profiles: [
            {
              ...buildProfile({
                id: 'profile-imported',
                name: '  Imported Work  ',
              }),
              name: 'Imported Work',
              credentials: { username: '', password: '' },
              lastAppliedAt: undefined,
              lastError: undefined,
            },
          ],
        }),
      );
    }
  });

  it('imports legacy single-settings json as one imported profile', () => {
    const result = importProfilesState(
      JSON.stringify({
        enabled: true,
        activeMode: 'socks',
        proxyMode: 'singleProxy',
        proxies: {
          socks: { host: '127.0.0.1', port: '1080' },
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.version).toBe(2);
      expect(result.state.profiles).toHaveLength(1);
      expect(result.state.activeProfileId).toBe(result.state.profiles[0]!.id);
      expect(result.state.profiles[0]!.name).toBe('Imported Profile');
      expect(result.state.profiles[0]!.credentials).toEqual({ username: '', password: '' });
      expect(result.state.profiles[0]!.settings.activeMode).toBe('socks');
      expect(result.state.profiles[0]!.settings.proxies.socks).toEqual({ host: '127.0.0.1', port: '1080' });
    }
  });

  it('rejects malformed json', () => {
    expect(importProfilesState('{')).toEqual({
      ok: false,
      error: 'Import file is not valid JSON.',
    });
  });
});
