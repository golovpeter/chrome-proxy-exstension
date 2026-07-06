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
