import { useEffect, useState } from 'react';
import type { ActiveProxyMode, ProxyProfile, ProxyProfilesState } from '../../src/core/settings';
import { sendRuntimeMessage, type ExtensionState } from '../../src/platform/messages';

const modes: { value: ActiveProxyMode; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks', label: 'SOCKS' },
];

export function Popup() {
  const [profilesState, setProfilesState] = useState<ProxyProfilesState | null>(null);
  const [activeProfile, setActiveProfile] = useState<ProxyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadState();
  }, []);

  async function loadState() {
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'GET_STATE' });

    if (response.ok) {
      applyExtensionState(response.data);
    } else {
      setError(response.error);
    }
  }

  function applyExtensionState(state: ExtensionState) {
    setProfilesState(state.profilesState);
    setActiveProfile(state.activeProfile);
    setError(state.activeProfile.lastError ?? null);
  }

  async function selectProfile(profileId: string) {
    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'SELECT_PROFILE', profileId });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
    } else {
      setError(response.error);
    }
  }

  async function selectMode(activeMode: ActiveProxyMode) {
    if (!activeProfile) {
      return;
    }

    const next: ProxyProfile = {
      ...activeProfile,
      settings: {
        ...activeProfile.settings,
        enabled: true,
        activeMode,
        proxyMode: 'singleProxy',
      },
    };

    setActiveProfile(next);
    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'SAVE_PROFILE', profile: next });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
    } else {
      setError(response.error);
    }
  }

  async function disableProxy() {
    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'DISABLE_PROXY' });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
    } else {
      setError(response.error);
    }
  }

  function openDashboard() {
    chrome.runtime.openOptionsPage();
  }

  const enabled = activeProfile?.settings.enabled ?? false;

  return (
    <main className="popup">
      <header>
        <div className="popup-brand">
          <img className="popup-brand-mark" src="/icon-48.png" alt="" />
          <div>
            <h1>Proxy Manager</h1>
            <p className={error ? 'status error' : enabled ? 'status enabled' : 'status disabled'}>
              {error ? 'Error' : enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
      </header>

      {error ? <div className="notice">{error}</div> : null}

      <section className="profile-list" aria-label="Profiles">
        <span className="popup-label">Profiles</span>
        {profilesState?.profiles.map((profile) => {
          const isActive = profile.id === activeProfile?.id;
          const endpoint = profile.settings.proxies[profile.settings.activeMode];
          const summary = !profile.settings.enabled
            ? 'Proxy off'
            : endpoint.host && endpoint.port
              ? `${endpoint.host}:${endpoint.port}`
              : 'Not configured';

          return (
            <button
              key={profile.id}
              type="button"
              aria-pressed={isActive}
              disabled={busy}
              onClick={() => void selectProfile(profile.id)}
            >
              <span className={`profile-dot${profile.settings.enabled ? ' on' : ''}`} aria-hidden />
              <span className="profile-item-text">
                <strong>{profile.name}</strong>
                <small>{summary}</small>
              </span>
              {isActive ? (
                <span className="profile-check" aria-hidden>
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </section>

      <section className="mode-picker" aria-label="Active proxy mode">
        <span className="popup-label">Mode</span>
        <div className="mode-grid">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              aria-pressed={enabled && activeProfile?.settings.activeMode === mode.value}
              disabled={busy || !activeProfile}
              onClick={() => void selectMode(mode.value)}
            >
              {mode.label}
            </button>
          ))}
          <button type="button" aria-pressed={!enabled} disabled={busy || !activeProfile} onClick={() => void disableProxy()}>
            Off
          </button>
        </div>
        <button type="button" className="dashboard-link" onClick={openDashboard}>
          Settings
        </button>
      </section>
    </main>
  );
}
