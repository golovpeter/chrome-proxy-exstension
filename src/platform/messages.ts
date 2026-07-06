import type { ProxyProfile, ProxyProfilesState } from '../core/settings';

export type RuntimeMessage =
  | { type: 'GET_STATE' }
  | { type: 'SAVE_PROFILE'; profile: ProxyProfile }
  | { type: 'CREATE_PROFILE' }
  | { type: 'DUPLICATE_PROFILE'; profileId: string }
  | { type: 'DELETE_PROFILE'; profileId: string }
  | { type: 'SELECT_PROFILE'; profileId: string }
  | { type: 'DISABLE_PROXY' }
  | { type: 'RESET_SETTINGS' }
  | { type: 'CHECK_CONNECTION' };

export type RuntimeResponse<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ExtensionState {
  profilesState: ProxyProfilesState;
  activeProfile: ProxyProfile;
}

export function sendRuntimeMessage<T>(message: RuntimeMessage): Promise<RuntimeResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: RuntimeResponse<T> | undefined) => {
      const error = chrome.runtime.lastError;

      if (error) {
        resolve({ ok: false, error: error.message ?? 'Runtime messaging failed.' });
        return;
      }

      resolve(response ?? { ok: false, error: 'Extension did not return a response.' });
    });
  });
}
