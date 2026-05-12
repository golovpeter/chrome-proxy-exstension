export type ActiveProxyMode = 'http' | 'https' | 'socks';

export type ProxyMode = 'singleProxy' | 'perProtocol';

export type SocksVersion = 'socks4' | 'socks5';

export interface ProxyEndpoint {
  host: string;
  port: string;
}

export interface ProxyCredentials {
  username: string;
  password: string;
}

export interface ProxySettings {
  enabled: boolean;
  activeMode: ActiveProxyMode;
  proxyMode: ProxyMode;
  proxies: {
    http: ProxyEndpoint;
    https: ProxyEndpoint;
    socks: ProxyEndpoint;
  };
  socksVersion: SocksVersion;
  bypassListRaw: string;
  bypassList: string[];
  credentials: ProxyCredentials;
  lastAppliedAt?: string;
  lastError?: string;
}

export const DEFAULT_SETTINGS: ProxySettings = {
  enabled: false,
  activeMode: 'http',
  proxyMode: 'singleProxy',
  proxies: {
    http: { host: '', port: '' },
    https: { host: '', port: '' },
    socks: { host: '', port: '' },
  },
  socksVersion: 'socks5',
  bypassListRaw: '<local>',
  bypassList: ['<local>'],
  credentials: {
    username: '',
    password: '',
  },
};
