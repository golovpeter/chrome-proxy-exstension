import { describe, expect, it } from 'vitest';
import { exportSettings, importSettings } from './importExport';
import { DEFAULT_SETTINGS, type ProxySettings } from './settings';

function validSettings(overrides: Partial<ProxySettings> = {}): ProxySettings {
  return {
    ...DEFAULT_SETTINGS,
    enabled: true,
    proxies: {
      http: { host: 'http.proxy.local', port: '8080' },
      https: { host: 'https.proxy.local', port: '8443' },
      socks: { host: 'socks.proxy.local', port: '1080' },
    },
    bypassListRaw: '<local>, *.example.com',
    bypassList: ['<local>', '*.example.com'],
    credentials: { username: 'user', password: 'secret' },
    ...overrides,
  };
}

describe('settings import/export', () => {
  it('exports settings as pretty json without credentials', () => {
    const json = exportSettings(validSettings());
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(json).toContain('\n  "enabled"');
    expect(parsed.credentials).toBeUndefined();
    expect(parsed.proxies).toEqual({
      http: { host: 'http.proxy.local', port: '8080' },
      https: { host: 'https.proxy.local', port: '8443' },
      socks: { host: 'socks.proxy.local', port: '1080' },
    });
  });

  it('imports valid json and merges defaults', () => {
    const result = importSettings(
      JSON.stringify({
        enabled: true,
        activeMode: 'socks',
        proxyMode: 'singleProxy',
        proxies: {
          socks: { host: 'socks.proxy.local', port: '1080' },
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.settings.activeMode).toBe('socks');
      expect(result.settings.proxies.socks).toEqual({ host: 'socks.proxy.local', port: '1080' });
      expect(result.settings.credentials).toEqual({ username: '', password: '' });
    }
  });

  it('rejects malformed json', () => {
    expect(importSettings('{')).toEqual({
      ok: false,
      error: 'Import file is not valid JSON.',
    });
  });

  it('rejects settings with invalid active proxy port', () => {
    const result = importSettings(
      JSON.stringify({
        enabled: true,
        activeMode: 'http',
        proxyMode: 'singleProxy',
        proxies: {
          http: { host: 'proxy.local', port: '70000' },
        },
      }),
    );

    expect(result.ok).toBe(false);
  });
});
