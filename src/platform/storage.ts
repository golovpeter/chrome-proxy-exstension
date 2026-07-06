import {
  createProfilesState,
  DEFAULT_SETTINGS,
  normalizeProfile,
  normalizeProfilesState,
  profileToSettings,
  settingsToProfile,
  type ProxyCredentials,
  type ProxyProfile,
  type ProxyProfilesState,
  type ProxySettings,
} from '../core/settings';

const PROFILES_STATE_KEY = 'proxyProfilesState';
const SETTINGS_KEY = 'proxySettings';
const CREDENTIALS_KEY = 'proxyCredentials';

interface ProfilesStateResult {
  [PROFILES_STATE_KEY]?: ProxyProfilesState;
}

interface LegacyStorageResult {
  [SETTINGS_KEY]?: ProxySettings;
  [CREDENTIALS_KEY]?: ProxyCredentials;
}

export async function loadProfilesState(): Promise<ProxyProfilesState> {
  const result = await storageGet<ProfilesStateResult>(PROFILES_STATE_KEY);
  const state = result[PROFILES_STATE_KEY];

  if (state) {
    return normalizeProfilesState(state);
  }

  const migratedState = await migrateLegacyState();
  await saveProfilesState(migratedState);
  return migratedState;
}

export async function saveProfilesState(state: ProxyProfilesState): Promise<void> {
  await storageSet({ [PROFILES_STATE_KEY]: normalizeProfilesState(state) });
}

export async function resetProfilesState(): Promise<ProxyProfilesState> {
  const state = createProfilesState();
  await saveProfilesState(state);
  return state;
}

export function getActiveProfile(state: ProxyProfilesState): ProxyProfile {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0]!;
}

export async function saveProfile(profile: ProxyProfile): Promise<ProxyProfilesState> {
  const state = await loadProfilesState();
  const nextProfile = normalizeProfile(profile);
  const hasExistingProfile = state.profiles.some((current) => current.id === nextProfile.id);
  const profiles = hasExistingProfile
    ? state.profiles.map((current) => (current.id === nextProfile.id ? nextProfile : current))
    : [...state.profiles, nextProfile];
  const nextState = normalizeProfilesState({
    version: 2,
    activeProfileId: state.activeProfileId,
    profiles,
  });

  await saveProfilesState(nextState);
  return nextState;
}

export async function selectProfile(profileId: string): Promise<ProxyProfilesState> {
  const state = await loadProfilesState();

  if (!state.profiles.some((profile) => profile.id === profileId)) {
    throw new Error(`Profile "${profileId}" not found.`);
  }

  const nextState = normalizeProfilesState({
    ...state,
    activeProfileId: profileId,
  });

  await saveProfilesState(nextState);
  return nextState;
}

export async function loadSettings(): Promise<ProxySettings> {
  return profileToSettings(getActiveProfile(await loadProfilesState()));
}

export async function saveSettings(settings: ProxySettings): Promise<void> {
  const state = await loadProfilesState();
  const activeProfile = getActiveProfile(state);

  await saveProfile(toStoredProfile(activeProfile, settings, activeProfile.credentials));
}

export async function saveSettingsWithCredentials(settings: ProxySettings): Promise<void> {
  const state = await loadProfilesState();
  const activeProfile = getActiveProfile(state);

  await saveProfile(toStoredProfile(activeProfile, settings, settings.credentials));
}

export async function resetSettings(): Promise<ProxySettings> {
  const state = await resetProfilesState();
  return profileToSettings(getActiveProfile(state));
}

export async function loadCredentials(): Promise<ProxyCredentials> {
  return { ...getActiveProfile(await loadProfilesState()).credentials };
}

export async function saveCredentials(credentials: ProxyCredentials): Promise<void> {
  const state = await loadProfilesState();
  const activeProfile = getActiveProfile(state);

  await saveProfile(toStoredProfile(activeProfile, profileToSettings(activeProfile), credentials));
}

export async function clearCredentials(): Promise<void> {
  await saveCredentials(DEFAULT_SETTINGS.credentials);
}

async function migrateLegacyState(): Promise<ProxyProfilesState> {
  const result = await storageGet<LegacyStorageResult>([SETTINGS_KEY, CREDENTIALS_KEY]);
  const credentials = {
    ...DEFAULT_SETTINGS.credentials,
    ...result[CREDENTIALS_KEY],
  };
  const settings = result[SETTINGS_KEY];
  const profile = settingsToProfile(
    {
      ...DEFAULT_SETTINGS,
      ...settings,
      proxies: {
        http: { ...DEFAULT_SETTINGS.proxies.http, ...settings?.proxies?.http },
        https: { ...DEFAULT_SETTINGS.proxies.https, ...settings?.proxies?.https },
        socks: { ...DEFAULT_SETTINGS.proxies.socks, ...settings?.proxies?.socks },
      },
      bypassList: settings?.bypassList ? [...settings.bypassList] : [...DEFAULT_SETTINGS.bypassList],
      credentials,
    },
    'Default',
  );

  return createProfilesState([profile]);
}

function toStoredProfile(profile: ProxyProfile, settings: ProxySettings, credentials: ProxyCredentials): ProxyProfile {
  const nextProfile = settingsToProfile(
    {
      ...settings,
      credentials,
    },
    profile.name,
  );

  return {
    ...nextProfile,
    id: profile.id,
    name: profile.name,
    credentials: { ...credentials },
  };
}

function storageGet<T>(keys: string | string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(items as T);
    });
  });
}

function storageSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}
