import { parseBypassRules } from './bypassRules';
import {
  createProfilesState,
  DEFAULT_PROFILE_SETTINGS,
  DEFAULT_SETTINGS,
  normalizeProfilesState,
  profileToSettings,
  settingsToProfile,
  type ActiveProxyMode,
  type ProfileProxySettings,
  type ProxyMode,
  type ProxyProfile,
  type ProxyProfilesState,
  type ProxySettings,
  type SocksVersion,
} from './settings';
import { validateProfileSettings, validateSettings } from './validation';

export type ImportProfilesResult = { ok: true; state: ProxyProfilesState } | { ok: false; error: string };
export type ImportSettingsResult = { ok: true; settings: ProxySettings } | { ok: false; error: string };

type ExportableProfile = Omit<ProxyProfile, 'credentials' | 'lastAppliedAt' | 'lastError'>;
type ExportableProfilesState = Omit<ProxyProfilesState, 'profiles'> & {
  profiles: ExportableProfile[];
};

export function exportProfilesState(state: ProxyProfilesState): string {
  const normalizedState = normalizeProfilesState(state);
  const exportable: ExportableProfilesState = {
    version: 2,
    activeProfileId: normalizedState.activeProfileId,
    profiles: normalizedState.profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      settings: profile.settings,
    })),
  };

  return JSON.stringify(exportable, null, 2);
}

export function importProfilesState(json: string): ImportProfilesResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Import file is not valid JSON.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'Import file must contain a settings object.' };
  }

  if (isLegacySettingsRecord(parsed)) {
    return importLegacySettings(parsed);
  }

  if (!Array.isArray(parsed.profiles)) {
    return { ok: false, error: 'Import file must contain a profiles array.' };
  }

  const state = normalizeProfilesState({
    version: 2,
    activeProfileId: typeof parsed.activeProfileId === 'string' ? parsed.activeProfileId : '',
    profiles: parsed.profiles.map((profile) => mergeProfile(profile)),
  });
  const validationError = validateProfilesState(state);

  if (validationError) {
    return { ok: false, error: validationError };
  }

  return { ok: true, state };
}

export function exportSettings(settings: ProxySettings): string {
  return exportProfilesState(createProfilesState([settingsToProfile(settings, 'Default')]));
}

export function importSettings(json: string): ImportSettingsResult {
  const result = importProfilesState(json);

  if (!result.ok) {
    return result;
  }

  const activeProfile = result.state.profiles.find((profile) => profile.id === result.state.activeProfileId) ?? result.state.profiles[0]!;

  return {
    ok: true,
    settings: profileToSettings(activeProfile),
  };
}

function importLegacySettings(value: Record<string, unknown>): ImportProfilesResult {
  const settings = mergeLegacySettings(value);
  const validation = validateSettings(settings);

  if (!validation.valid) {
    return {
      ok: false,
      error: validation.errors.map((error) => error.message).join(' '),
    };
  }

  return {
    ok: true,
    state: createProfilesState([settingsToProfile(settings, 'Imported Profile')]),
  };
}

function validateProfilesState(state: ProxyProfilesState): string | null {
  const errors = state.profiles.flatMap((profile) =>
    validateProfileSettings(profile.settings).errors.map((error) => `${profile.name}: ${error.message}`),
  );

  return errors.length > 0 ? errors.join(' ') : null;
}

function mergeProfile(value: unknown): ProxyProfile {
  const profile = isRecord(value) ? value : {};

  return {
    id: typeof profile.id === 'string' ? profile.id : '',
    name: typeof profile.name === 'string' ? profile.name : '',
    settings: mergeProfileSettings(isRecord(profile.settings) ? profile.settings : {}),
    credentials: { ...DEFAULT_SETTINGS.credentials },
  };
}

function mergeProfileSettings(value: Record<string, unknown>): ProfileProxySettings {
  const bypassListRaw = typeof value.bypassListRaw === 'string' ? value.bypassListRaw : DEFAULT_PROFILE_SETTINGS.bypassListRaw;
  const parsedBypass = parseBypassRules(bypassListRaw);

  return {
    ...DEFAULT_PROFILE_SETTINGS,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_PROFILE_SETTINGS.enabled,
    activeMode: isActiveMode(value.activeMode) ? value.activeMode : DEFAULT_PROFILE_SETTINGS.activeMode,
    proxyMode: isProxyMode(value.proxyMode) ? value.proxyMode : DEFAULT_PROFILE_SETTINGS.proxyMode,
    socksVersion: isSocksVersion(value.socksVersion) ? value.socksVersion : DEFAULT_PROFILE_SETTINGS.socksVersion,
    proxies: {
      http: readEndpoint(value, 'http'),
      https: readEndpoint(value, 'https'),
      socks: readEndpoint(value, 'socks'),
    },
    bypassListRaw,
    bypassList: parsedBypass.rules,
  };
}

function mergeLegacySettings(value: Record<string, unknown>): ProxySettings {
  return {
    ...mergeProfileSettings(value),
    credentials: { ...DEFAULT_SETTINGS.credentials },
  };
}

function isLegacySettingsRecord(value: Record<string, unknown>): boolean {
  return !('profiles' in value) && 'proxies' in value;
}

function readEndpoint(value: Record<string, unknown>, key: ActiveProxyMode) {
  const proxies = isRecord(value.proxies) ? value.proxies : {};
  const endpoint = isRecord(proxies[key]) ? proxies[key] : {};
  const fallback = DEFAULT_SETTINGS.proxies[key];

  return {
    host: typeof endpoint.host === 'string' ? endpoint.host : fallback.host,
    port: typeof endpoint.port === 'string' ? endpoint.port : fallback.port,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isActiveMode(value: unknown): value is ActiveProxyMode {
  return value === 'http' || value === 'https' || value === 'socks';
}

function isProxyMode(value: unknown): value is ProxyMode {
  return value === 'singleProxy' || value === 'perProtocol';
}

function isSocksVersion(value: unknown): value is SocksVersion {
  return value === 'socks4' || value === 'socks5';
}
