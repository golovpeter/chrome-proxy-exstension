import type { ProxyCredentials, ProxySettings } from '../core/settings';

export type RuntimeMessage =
  | { type: 'GET_STATE' }
  | { type: 'SAVE_SETTINGS'; settings: ProxySettings }
  | { type: 'APPLY_SETTINGS' }
  | { type: 'DISABLE_PROXY' }
  | { type: 'RESET_SETTINGS' }
  | { type: 'CHECK_CONNECTION' }
  | { type: 'SAVE_CREDENTIALS'; credentials: ProxyCredentials }
  | { type: 'CLEAR_CREDENTIALS' };

export type RuntimeResponse<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ExtensionState {
  settings: ProxySettings;
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
