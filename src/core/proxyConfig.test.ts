import { describe, expect, it } from 'vitest';
import { buildProxyConfig } from './proxyConfig';
import { DEFAULT_SETTINGS, type ProxySettings } from './settings';

function settings(overrides: Partial<ProxySettings> = {}): ProxySettings {
  return {
    ...DEFAULT_SETTINGS,
    enabled: true,
    proxies: {
      http: { host: 'http.proxy.local', port: '8080' },
      https: { host: 'https.proxy.local', port: '8443' },
      socks: { host: 'socks.proxy.local', port: '1080' },
    },
    bypassList: ['<local>', '*.example.com'],
    ...overrides,
  };
}

describe('buildProxyConfig', () => {
  it('returns null when proxy is disabled', () => {
    expect(buildProxyConfig(settings({ enabled: false }))).toBeNull();
  });

  it('uses active mode as singleProxy', () => {
    expect(buildProxyConfig(settings({ proxyMode: 'singleProxy', activeMode: 'socks' }))).toEqual({
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: 'socks5',
          host: 'socks.proxy.local',
          port: 1080,
        },
        bypassList: ['<local>', '*.example.com'],
      },
    });
  });

  it('maps per protocol proxies and uses socks as fallback', () => {
    expect(buildProxyConfig(settings({ proxyMode: 'perProtocol', socksVersion: 'socks4' }))).toEqual({
      mode: 'fixed_servers',
      rules: {
        proxyForHttp: {
          scheme: 'http',
          host: 'http.proxy.local',
          port: 8080,
        },
        proxyForHttps: {
          scheme: 'https',
          host: 'https.proxy.local',
          port: 8443,
        },
        fallbackProxy: {
          scheme: 'socks4',
          host: 'socks.proxy.local',
          port: 1080,
        },
        bypassList: ['<local>', '*.example.com'],
      },
    });
  });
});
