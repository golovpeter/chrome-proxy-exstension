import type { ActiveProxyMode, ProxyEndpoint, ProxySettings, SocksVersion } from './settings';

export type ProxyScheme = 'http' | 'https' | 'socks4' | 'socks5';

export interface ProxyServerConfig {
  scheme: ProxyScheme;
  host: string;
  port: number;
}

export interface FixedProxyRules {
  singleProxy?: ProxyServerConfig;
  proxyForHttp?: ProxyServerConfig;
  proxyForHttps?: ProxyServerConfig;
  fallbackProxy?: ProxyServerConfig;
  bypassList?: string[];
}

export interface FixedProxyConfig {
  mode: 'fixed_servers';
  rules: FixedProxyRules;
}

export function buildProxyConfig(settings: ProxySettings): FixedProxyConfig | null {
  if (!settings.enabled) {
    return null;
  }

  const rules: FixedProxyRules =
    settings.proxyMode === 'singleProxy'
      ? {
          singleProxy: toProxyServer(settings.activeMode, settings.proxies[settings.activeMode], settings.socksVersion),
        }
      : {
          proxyForHttp: toProxyServer('http', settings.proxies.http, settings.socksVersion),
          proxyForHttps: toProxyServer('https', settings.proxies.https, settings.socksVersion),
          fallbackProxy: toProxyServer('socks', settings.proxies.socks, settings.socksVersion),
        };

  if (settings.bypassList.length > 0) {
    rules.bypassList = settings.bypassList;
  }

  return {
    mode: 'fixed_servers',
    rules,
  };
}

function toProxyServer(mode: ActiveProxyMode, endpoint: ProxyEndpoint, socksVersion: SocksVersion): ProxyServerConfig {
  return {
    scheme: mode === 'socks' ? socksVersion : mode,
    host: endpoint.host.trim(),
    port: Number(endpoint.port),
  };
}
