import { useEffect, useMemo, useState } from 'react';
import type { ActiveProxyMode, ProxySettings } from '../../src/core/settings';
import { sendRuntimeMessage, type ExtensionState } from '../../src/platform/messages';

const modes: { value: ActiveProxyMode; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks', label: 'SOCKS' },
];

export function Popup() {
  const [settings, setSettings] = useState<ProxySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadState();
  }, []);

  const currentProxy = useMemo(() => {
    if (!settings) {
      return 'No proxy loaded';
    }

    if (!settings.enabled) {
      return 'Proxy disabled';
    }

    const endpoint = settings.proxies[settings.activeMode];
    return endpoint.host && endpoint.port ? `${endpoint.host}:${endpoint.port}` : 'Proxy not configured';
  }, [settings]);

  async function loadState() {
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'GET_STATE' });

    if (response.ok) {
      setSettings(response.data.settings);
      setError(response.data.settings.lastError ?? null);
    } else {
      setError(response.error);
    }
  }

  async function selectMode(activeMode: ActiveProxyMode) {
    if (!settings) {
      return;
    }

    const next = { ...settings, enabled: true, activeMode, proxyMode: 'singleProxy' as const };
    setSettings(next);
    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'SAVE_SETTINGS', settings: next });
    setBusy(false);

    if (response.ok) {
      setSettings(response.data.settings);
      setError(response.data.settings.lastError ?? null);
    } else {
      setError(response.error);
    }
  }

  async function disableProxy() {
    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'DISABLE_PROXY' });
    setBusy(false);

    if (response.ok) {
      setSettings(response.data.settings);
      setError(null);
    } else {
      setError(response.error);
    }
  }

  function openDashboard() {
    chrome.runtime.openOptionsPage();
  }

  const enabled = settings?.enabled ?? false;

  return (
    <main className="popup">
      <header>
        <div>
          <h1>Proxy Manager</h1>
          <p className={error ? 'status error' : enabled ? 'status enabled' : 'status disabled'}>
            {error ? 'Error' : enabled ? 'Enabled' : 'Disabled'}
          </p>
        </div>
      </header>

      {error ? <div className="notice">{error}</div> : null}
      <section className="mode-picker" aria-label="Active proxy mode">
        {modes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            aria-pressed={enabled && settings?.activeMode === mode.value}
            disabled={busy || !settings}
            onClick={() => void selectMode(mode.value)}
          >
            {mode.label}
          </button>
        ))}
        <button type="button" aria-pressed={!enabled} disabled={busy || !settings} onClick={() => void disableProxy()}>
          Disabled
        </button>
        <button type="button" aria-pressed={false} onClick={openDashboard}>
          Конфигурация
        </button>
      </section>

      <section className="proxy-summary">
        <span>Current proxy</span>
        <strong>{currentProxy}</strong>
      </section>
    </main>
  );
}
