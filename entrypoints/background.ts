import { parseBypassRules } from '../src/core/bypassRules';
import { createDefaultProfile, profileToSettings, settingsToProfile, type ProxyProfile, type ProxyProfilesState } from '../src/core/settings';
import { validateProfileSettings } from '../src/core/validation';
import { registerAuthHandler } from '../src/platform/auth';
import type { ExtensionState, RuntimeMessage, RuntimeResponse } from '../src/platform/messages';
import { applyProxySettings, checkConnection, clearProxySettings } from '../src/platform/proxy';
import {
  getActiveProfile,
  loadProfilesState,
  resetProfilesState,
  saveProfile,
  saveProfilesState,
  selectProfile,
} from '../src/platform/storage';

export default defineBackground(() => {
  registerAuthHandler();

  chrome.runtime.onInstalled.addListener(() => {
    void applyPersistedSettingsOnStartup();
  });

  void applyPersistedSettingsOnStartup();

  chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    void handleMessage(message).then(sendResponse);
    return true;
  });
});

async function handleMessage(message: RuntimeMessage): Promise<RuntimeResponse<unknown>> {
  try {
    switch (message.type) {
      case 'GET_STATE':
        return ok(await loadExtensionState());
      case 'SAVE_PROFILE':
        await saveAndMaybeApplyProfile(message.profile);
        return ok(await loadExtensionState());
      case 'SELECT_PROFILE':
        await selectAndApplyProfile(message.profileId);
        return ok(await loadExtensionState());
      case 'CREATE_PROFILE':
        await createAndSelectProfile();
        return ok(await loadExtensionState());
      case 'DUPLICATE_PROFILE':
        await duplicateAndSelectProfile(message.profileId);
        return ok(await loadExtensionState());
      case 'DELETE_PROFILE':
        await deleteProfileAndMaybeReapply(message.profileId);
        return ok(await loadExtensionState());
      case 'REPLACE_PROFILES_STATE':
        await replaceProfilesState(message.profilesState);
        return ok(await loadExtensionState());
      case 'DISABLE_PROXY':
        await disableActiveProfile();
        return ok(await loadExtensionState());
      case 'RESET_SETTINGS':
        await clearProxySettings();
        await resetProfilesState();
        return ok(await loadExtensionState());
      case 'CHECK_CONNECTION':
        return ok(await checkConnection());
      default:
        return fail('Unknown runtime message.');
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Unexpected extension error.');
  }
}

async function loadExtensionState(): Promise<ExtensionState> {
  const profilesState = await loadProfilesState();

  return {
    profilesState,
    activeProfile: getActiveProfile(profilesState),
  };
}

async function saveAndMaybeApplyProfile(profile: ProxyProfile): Promise<void> {
  const state = await loadProfilesState();
  const nextProfile = prepareProfileForSave(profile);
  const activeProfile = getActiveProfile(state);

  if (state.activeProfileId === nextProfile.id && activeProfile.settings.enabled && !nextProfile.settings.enabled) {
    await clearProxySettingsForProfile(activeProfile);
    await saveProfile(nextProfile);
    return;
  }

  await saveProfile(nextProfile);

  if (state.activeProfileId === nextProfile.id) {
    await applyPersistedSettings();
  }
}

async function applyPersistedSettings(): Promise<void> {
  const state = await loadProfilesState();
  const activeProfile = getActiveProfile(state);

  if (!activeProfile.settings.enabled) {
    await clearProxySettingsForProfile(activeProfile);
    return;
  }

  try {
    await applyProxySettings(profileToSettings(activeProfile));
    await saveProfile({
      ...activeProfile,
      lastAppliedAt: new Date().toISOString(),
      lastError: undefined,
    });
  } catch (error) {
    await saveProfile({
      ...activeProfile,
      lastError: getErrorMessage(error, 'Failed to apply proxy settings.'),
    });
  }
}

async function applyPersistedSettingsOnStartup(): Promise<void> {
  try {
    await applyPersistedSettings();
  } catch {
    // applyPersistedSettings records profile-level errors before rethrowing.
  }
}

async function selectAndApplyProfile(profileId: string): Promise<void> {
  const state = await loadProfilesState();
  const nextProfile = state.profiles.find((profile) => profile.id === profileId);

  if (!nextProfile) {
    throw new Error(`Profile "${profileId}" not found.`);
  }

  if (!nextProfile.settings.enabled) {
    await clearProxySettingsForProfile(getActiveProfile(state));
    await selectProfile(profileId);
    return;
  }

  await selectProfile(profileId);
  await applyPersistedSettings();
}

async function createAndSelectProfile(): Promise<void> {
  const state = await loadProfilesState();
  const profile = createDefaultProfile(getNextProfileName(state));

  await saveProfile(profile);
  await selectAndApplyProfile(profile.id);
}

async function duplicateAndSelectProfile(profileId: string): Promise<void> {
  const state = await loadProfilesState();
  const sourceProfile = state.profiles.find((profile) => profile.id === profileId);

  if (!sourceProfile) {
    throw new Error(`Profile "${profileId}" not found.`);
  }

  const duplicate = settingsToProfile(
    {
      ...profileToSettings(sourceProfile),
      lastAppliedAt: undefined,
      lastError: undefined,
    },
    `${sourceProfile.name} Copy`,
  );

  await saveProfile(duplicate);
  await selectAndApplyProfile(duplicate.id);
}

async function deleteProfileAndMaybeReapply(profileId: string): Promise<void> {
  const state = await loadProfilesState();

  if (state.profiles.length === 1) {
    throw new Error('Cannot delete the last remaining profile.');
  }

  if (!state.profiles.some((profile) => profile.id === profileId)) {
    throw new Error(`Profile "${profileId}" not found.`);
  }

  const profiles = state.profiles.filter((profile) => profile.id !== profileId);
  const nextActiveProfileId = state.activeProfileId === profileId ? profiles[0]!.id : state.activeProfileId;
  const activeProfileChanged = nextActiveProfileId !== state.activeProfileId;
  const nextState: ProxyProfilesState = {
    version: 2,
    activeProfileId: nextActiveProfileId,
    profiles,
  };

  if (activeProfileChanged) {
    const nextActiveProfile = profiles.find((profile) => profile.id === nextActiveProfileId)!;

    if (!nextActiveProfile.settings.enabled) {
      await clearProxySettingsForProfile(getActiveProfile(state));
      await saveProfilesState(nextState);
      return;
    }
  }

  await saveProfilesState(nextState);

  if (activeProfileChanged) {
    await applyPersistedSettings();
  }
}

async function replaceProfilesState(state: ProxyProfilesState): Promise<void> {
  await saveProfilesState(state);
  await applyPersistedSettings();
}

async function disableActiveProfile(): Promise<void> {
  const state = await loadProfilesState();
  const activeProfile = getActiveProfile(state);

  await clearProxySettingsForProfile(activeProfile);
  await saveProfile({
    ...activeProfile,
    settings: {
      ...activeProfile.settings,
      enabled: false,
    },
    lastError: undefined,
  });
}

function prepareProfileForSave(profile: ProxyProfile): ProxyProfile {
  const bypass = parseBypassRules(profile.settings.bypassListRaw);
  const nextProfile: ProxyProfile = {
    ...profile,
    settings: {
      ...profile.settings,
      bypassList: bypass.rules,
    },
    credentials: { ...profile.credentials },
    lastError: undefined,
  };
  const validation = validateProfileSettings(nextProfile.settings);

  if (!validation.valid) {
    throw new Error(validation.errors.map((error) => error.message).join(' '));
  }

  return nextProfile;
}

function getNextProfileName(state: ProxyProfilesState): string {
  const existingNames = new Set(state.profiles.map((profile) => profile.name));
  let index = state.profiles.length + 1;
  let name = `Profile ${index}`;

  while (existingNames.has(name)) {
    index += 1;
    name = `Profile ${index}`;
  }

  return name;
}

async function clearProxySettingsForProfile(profile: ProxyProfile): Promise<void> {
  try {
    await clearProxySettings();
  } catch (error) {
    await saveProfile({
      ...profile,
      lastError: getErrorMessage(error, 'Failed to clear proxy settings.'),
    });
    throw error;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function ok<T>(data: T): RuntimeResponse<T> {
  return { ok: true, data };
}

function fail(error: string): RuntimeResponse<never> {
  return { ok: false, error };
}
