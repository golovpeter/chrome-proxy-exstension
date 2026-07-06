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

export const DEFAULT_PROFILE_SETTINGS: ProfileProxySettings = {
  enabled: DEFAULT_SETTINGS.enabled,
  activeMode: DEFAULT_SETTINGS.activeMode,
  proxyMode: DEFAULT_SETTINGS.proxyMode,
  proxies: {
    http: { ...DEFAULT_SETTINGS.proxies.http },
    https: { ...DEFAULT_SETTINGS.proxies.https },
    socks: { ...DEFAULT_SETTINGS.proxies.socks },
  },
  socksVersion: DEFAULT_SETTINGS.socksVersion,
  bypassListRaw: DEFAULT_SETTINGS.bypassListRaw,
  bypassList: [...DEFAULT_SETTINGS.bypassList],
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
  const firstProfile = normalizedProfiles[0]!;

  return normalizeProfilesState({
    version: 2,
    activeProfileId: firstProfile.id,
    profiles: normalizedProfiles,
  });
}

export function normalizeProfilesState(state: ProxyProfilesState): ProxyProfilesState {
  const profiles = state.profiles.length ? state.profiles.map(normalizeProfile) : [createDefaultProfile()];
  const firstProfile = profiles[0]!;
  const activeProfileId = profiles.some((profile) => profile.id === state.activeProfileId)
    ? state.activeProfileId
    : firstProfile.id;

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
    bypassList: settings.bypassList ? [...settings.bypassList] : [...DEFAULT_PROFILE_SETTINGS.bypassList],
  };
}

export function profileToSettings(profile: ProxyProfile): ProxySettings {
  return {
    ...cloneProfileSettings(profile.settings),
    credentials: { ...profile.credentials },
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
