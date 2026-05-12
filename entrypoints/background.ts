import { parseBypassRules } from '../src/core/bypassRules';
import type { ProxySettings } from '../src/core/settings';
import { validateSettings } from '../src/core/validation';
import { registerAuthHandler } from '../src/platform/auth';
import type { ExtensionState, RuntimeMessage, RuntimeResponse } from '../src/platform/messages';
import { applyProxySettings, checkConnection, clearProxySettings } from '../src/platform/proxy';
import { clearCredentials, loadSettings, resetSettings, saveCredentials, saveSettings } from '../src/platform/storage';

export default defineBackground(() => {
  registerAuthHandler();

  chrome.runtime.onInstalled.addListener(() => {
    void applyPersistedSettings();
  });

  void applyPersistedSettings();

  chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    void handleMessage(message).then(sendResponse);
    return true;
  });
});

async function handleMessage(message: RuntimeMessage): Promise<RuntimeResponse<unknown>> {
  try {
    switch (message.type) {
      case 'GET_STATE':
        return ok<ExtensionState>({ settings: await loadSettings() });
      case 'SAVE_SETTINGS':
        return ok<ExtensionState>({ settings: await saveAndMaybeApply(message.settings) });
      case 'APPLY_SETTINGS':
        await applyPersistedSettings();
        return ok<ExtensionState>({ settings: await loadSettings() });
      case 'DISABLE_PROXY':
        return ok<ExtensionState>({ settings: await disableProxy() });
      case 'RESET_SETTINGS':
        await clearProxySettings();
        return ok<ExtensionState>({ settings: await resetSettings() });
      case 'CHECK_CONNECTION':
        return ok(await checkConnection());
      case 'SAVE_CREDENTIALS':
        await saveCredentials(message.credentials);
        return ok<ExtensionState>({ settings: await loadSettings() });
      case 'CLEAR_CREDENTIALS':
        await clearCredentials();
        return ok<ExtensionState>({ settings: await loadSettings() });
      default:
        return fail('Unknown runtime message.');
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Unexpected extension error.');
  }
}

async function saveAndMaybeApply(settings: ProxySettings): Promise<ProxySettings> {
  const bypass = parseBypassRules(settings.bypassListRaw);
  const next: ProxySettings = {
    ...settings,
    bypassList: bypass.rules,
    lastError: undefined,
  };
  const validation = validateSettings(next);

  if (!validation.valid) {
    throw new Error(validation.errors.map((error) => error.message).join(' '));
  }

  await saveSettings(next);

  await applyPersistedSettings();

  return loadSettings();
}

async function applyPersistedSettings(): Promise<void> {
  const settings = await loadSettings();

  if (!settings.enabled) {
    await clearProxySettings();
    return;
  }

  try {
    await applyProxySettings(settings);
    await saveSettings({ ...settings, lastAppliedAt: new Date().toISOString(), lastError: undefined });
  } catch (error) {
    await saveSettings({
      ...settings,
      lastError: error instanceof Error ? error.message : 'Failed to apply proxy settings.',
    });
  }
}

async function disableProxy(): Promise<ProxySettings> {
  const settings = await loadSettings();
  const next = {
    ...settings,
    enabled: false,
    lastError: undefined,
  };

  await clearProxySettings();
  await saveSettings(next);
  return loadSettings();
}

function ok<T>(data: T): RuntimeResponse<T> {
  return { ok: true, data };
}

function fail(error: string): RuntimeResponse<never> {
  return { ok: false, error };
}
