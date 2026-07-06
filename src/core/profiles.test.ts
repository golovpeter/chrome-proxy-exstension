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
    const firstProfile = state.profiles[0]!;

    expect(state.version).toBe(2);
    expect(state.activeProfileId).toBe(firstProfile.id);
    expect(state.profiles).toHaveLength(2);
  });

  it('normalizes an empty state into one default profile', () => {
    const state = normalizeProfilesState({ version: 2, activeProfileId: 'missing', profiles: [] });
    const firstProfile = state.profiles[0]!;

    expect(state.profiles).toHaveLength(1);
    expect(state.activeProfileId).toBe(firstProfile.id);
    expect(firstProfile.name).toBe('Default');
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
    const firstProfile = state.profiles[0]!;

    expect(firstProfile.settings.proxies.socks).toEqual({ host: '127.0.0.1', port: '9050' });
    expect(firstProfile.credentials).toEqual({ username: 'user', password: 'pass' });
  });
});
