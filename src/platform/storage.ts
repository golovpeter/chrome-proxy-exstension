import { DEFAULT_SETTINGS, type ProxyCredentials, type ProxySettings } from '../core/settings';

const SETTINGS_KEY = 'proxySettings';
const CREDENTIALS_KEY = 'proxyCredentials';

export async function loadSettings(): Promise<ProxySettings> {
  const result = await storageGet<Partial<Record<typeof SETTINGS_KEY, ProxySettings>>>(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...result[SETTINGS_KEY],
    credentials: await loadCredentials(),
  };
}

export async function saveSettings(settings: ProxySettings): Promise<void> {
  const { credentials: _credentials, ...settingsWithoutCredentials } = settings;
  await storageSet({ [SETTINGS_KEY]: settingsWithoutCredentials });
}

export async function resetSettings(): Promise<ProxySettings> {
  await storageSet({
    [SETTINGS_KEY]: {
      ...DEFAULT_SETTINGS,
      credentials: undefined,
    },
    [CREDENTIALS_KEY]: DEFAULT_SETTINGS.credentials,
  });
  return DEFAULT_SETTINGS;
}

export async function loadCredentials(): Promise<ProxyCredentials> {
  const result = await storageGet<Partial<Record<typeof CREDENTIALS_KEY, ProxyCredentials>>>(CREDENTIALS_KEY);
  return {
    ...DEFAULT_SETTINGS.credentials,
    ...result[CREDENTIALS_KEY],
  };
}

export async function saveCredentials(credentials: ProxyCredentials): Promise<void> {
  await storageSet({ [CREDENTIALS_KEY]: credentials });
}

export async function clearCredentials(): Promise<void> {
  await storageSet({ [CREDENTIALS_KEY]: DEFAULT_SETTINGS.credentials });
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
