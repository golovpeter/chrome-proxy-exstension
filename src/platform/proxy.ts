import { buildProxyConfig } from '../core/proxyConfig';
import type { ProxySettings } from '../core/settings';

export async function applyProxySettings(settings: ProxySettings): Promise<void> {
  const config = buildProxyConfig(settings);

  if (!config) {
    await clearProxySettings();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    chrome.proxy.settings.set(
      {
        value: config as chrome.proxy.ProxyConfig,
        scope: 'regular',
      },
      () => {
        const error = chrome.runtime.lastError;

        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve();
      },
    );
  });
}

export async function clearProxySettings(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    chrome.proxy.settings.clear({ scope: 'regular' }, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

export async function checkConnection(timeoutMs = 7000): Promise<{ ok: true } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://www.google.com/generate_204', {
      cache: 'no-store',
      signal: controller.signal,
    });

    return response.ok || response.status === 204
      ? { ok: true }
      : { ok: false, error: `Connection check returned HTTP ${response.status}.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Connection check failed.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
