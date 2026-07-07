import { useEffect, useMemo, useRef, useState } from 'react';
import { parseBypassRules } from '../../src/core/bypassRules';
import { exportProfilesState, importProfilesState } from '../../src/core/importExport';
import {
  DEFAULT_SETTINGS,
  type ActiveProxyMode,
  type ProxyProfile,
  type ProxyProfilesState,
  type SocksVersion,
} from '../../src/core/settings';
import { validateHost, validatePort, validateProfileSettings } from '../../src/core/validation';
import { sendRuntimeMessage, type ExtensionState } from '../../src/platform/messages';
import { Button, Field, SectionHeader, SegmentedControl, StatusBanner, TextAreaField } from '../../src/ui/components';

type SectionId = 'proxy' | 'rules' | 'auth' | 'about';

const sections: { id: SectionId; label: string }[] = [
  { id: 'proxy', label: 'Proxy' },
  { id: 'rules', label: 'Bypass Rules' },
  { id: 'auth', label: 'Authentication' },
  { id: 'about', label: 'About' },
];

export function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('proxy');
  const [profilesState, setProfilesState] = useState<ProxyProfilesState | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [status, setStatus] = useState<{ tone: 'info' | 'success' | 'error' | 'warning'; message: string }>({
    tone: 'info',
    message: 'Loading profiles...',
  });
  const [busy, setBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const selectedProfile = useMemo(() => {
    return profilesState?.profiles.find((profile) => profile.id === selectedProfileId) ?? profilesState?.profiles[0] ?? null;
  }, [profilesState, selectedProfileId]);
  const validation = useMemo(
    () => (selectedProfile ? validateProfileSettings(selectedProfile.settings) : { valid: false, errors: [], warnings: [] }),
    [selectedProfile],
  );
  const bypassPreview = useMemo(
    () => parseBypassRules(selectedProfile?.settings.bypassListRaw ?? DEFAULT_SETTINGS.bypassListRaw),
    [selectedProfile?.settings.bypassListRaw],
  );
  const errorsByField = useMemo(() => {
    return new Map(validation.errors.map((error) => [error.field, error.message]));
  }, [validation.errors]);

  useEffect(() => {
    void loadState();
  }, []);

  async function loadState() {
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'GET_STATE' });
    if (response.ok) {
      applyExtensionState(response.data);
      setStatus({
        tone: response.data.activeProfile.lastError ? 'error' : 'info',
        message: getProfileStatus(response.data.activeProfile),
      });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  function applyExtensionState(state: ExtensionState) {
    setProfilesState(state.profilesState);
    setSelectedProfileId(state.activeProfile.id);
  }

  function updateProfilesState(nextState: ProxyProfilesState) {
    setProfilesState(nextState);
    setSelectedProfileId((current) =>
      nextState.profiles.some((profile) => profile.id === current) ? current : nextState.activeProfileId,
    );
  }

  function updateSelectedProfile(updater: (profile: ProxyProfile) => ProxyProfile) {
    if (!profilesState || !selectedProfile) {
      return;
    }

    updateProfilesState({
      ...profilesState,
      profiles: profilesState.profiles.map((profile) => (profile.id === selectedProfile.id ? updater(profile) : profile)),
    });
  }

  function updateProfileSettings(patch: Partial<ProxyProfile['settings']>) {
    updateSelectedProfile((profile) => ({
      ...profile,
      settings: {
        ...profile.settings,
        ...patch,
      },
    }));
  }

  function updateProxy(mode: ActiveProxyMode, field: 'host' | 'port', value: string) {
    updateSelectedProfile((profile) => ({
      ...profile,
      settings: {
        ...profile.settings,
        proxies: {
          ...profile.settings.proxies,
          [mode]: {
            ...profile.settings.proxies[mode],
            [field]: value,
          },
        },
      },
    }));
  }

  async function saveSelectedProfile(options: { enable?: boolean; successMessage?: string } = {}) {
    if (!selectedProfile) {
      return;
    }

    const profileToSave =
      options.enable === undefined
        ? selectedProfile
        : {
            ...selectedProfile,
            settings: {
              ...selectedProfile.settings,
              enabled: options.enable,
            },
          };

    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'SAVE_PROFILE', profile: profileToSave });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
      const savedName = response.data.profilesState.profiles.find((profile) => profile.id === profileToSave.id)?.name ?? profileToSave.name;
      setStatus({ tone: 'success', message: `${savedName} ${options.successMessage ?? 'saved.'}` });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function selectProfile(profileId: string) {
    if (!profilesState) {
      return;
    }

    setSelectedProfileId(profileId);

    if (profileId === profilesState.activeProfileId) {
      return;
    }

    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'SELECT_PROFILE', profileId });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
      setStatus({ tone: 'success', message: `${response.data.activeProfile.name} selected.` });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function createProfile() {
    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'CREATE_PROFILE' });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
      setStatus({ tone: 'success', message: `${response.data.activeProfile.name} created.` });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function duplicateProfile() {
    if (!selectedProfile) {
      return;
    }

    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'DUPLICATE_PROFILE', profileId: selectedProfile.id });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
      setStatus({ tone: 'success', message: `${response.data.activeProfile.name} created.` });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function deleteProfile() {
    if (!profilesState || !selectedProfile || profilesState.profiles.length === 1) {
      return;
    }

    if (!confirm(`Delete profile "${selectedProfile.name}"?`)) {
      return;
    }

    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'DELETE_PROFILE', profileId: selectedProfile.id });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
      setStatus({ tone: 'success', message: 'Profile deleted.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function disableProxy() {
    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'DISABLE_PROXY' });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
      setStatus({ tone: 'success', message: `${response.data.activeProfile.name} disabled.` });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function checkConnection() {
    if (!selectedProfile) {
      return;
    }

    const profileToCheck: ProxyProfile = {
      ...selectedProfile,
      settings: {
        ...selectedProfile.settings,
        enabled: true,
      },
    };
    const currentValidation = validateProfileSettings(profileToCheck.settings);

    if (!currentValidation.valid) {
      setStatus({ tone: 'error', message: currentValidation.errors.map((error) => error.message).join(' ') });
      return;
    }

    setBusy(true);
    setStatus({ tone: 'info', message: `Saving and applying ${selectedProfile.name} before check...` });
    const saveResponse = await sendRuntimeMessage<ExtensionState>({ type: 'SAVE_PROFILE', profile: profileToCheck });

    if (!saveResponse.ok) {
      setBusy(false);
      setStatus({ tone: 'error', message: saveResponse.error });
      return;
    }

    applyExtensionState(saveResponse.data);
    if (saveResponse.data.activeProfile.lastError) {
      setBusy(false);
      setStatus({ tone: 'error', message: saveResponse.data.activeProfile.lastError });
      return;
    }

    const response = await sendRuntimeMessage<{ ok: true } | { ok: false; error: string }>({ type: 'CHECK_CONNECTION' });
    setBusy(false);

    if (!response.ok) {
      setStatus({ tone: 'error', message: response.error });
      return;
    }

    if (!response.data.ok) {
      setStatus({ tone: 'error', message: response.data.error });
      return;
    }

    setStatus({ tone: 'success', message: 'Connection check passed successfully.' });
  }

  async function clearCredentials() {
    if (!selectedProfile) {
      return;
    }

    const profileToSave: ProxyProfile = {
      ...selectedProfile,
      credentials: { username: '', password: '' },
    };

    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'SAVE_PROFILE', profile: profileToSave });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
      setStatus({ tone: 'success', message: `${profileToSave.name} credentials cleared.` });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function resetSettings() {
    if (!confirm('Reset all profiles and credentials?')) {
      return;
    }

    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'RESET_SETTINGS' });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
      setStatus({ tone: 'success', message: 'Profiles reset to defaults.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  function handleExport() {
    if (!profilesState) {
      return;
    }

    const blob = new Blob([exportProfilesState(profilesState)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'chrome-proxy-manager-profiles.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File | undefined) {
    if (!file) {
      return;
    }

    const result = importProfilesState(await file.text());
    if (!result.ok) {
      setStatus({ tone: 'error', message: result.error });
      return;
    }

    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({
      type: 'REPLACE_PROFILES_STATE',
      profilesState: result.state,
    });
    setBusy(false);

    if (response.ok) {
      applyExtensionState(response.data);
      setStatus({ tone: 'warning', message: 'Profiles imported. Credentials were not imported; re-enter them per profile.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  const settings = selectedProfile?.settings;
  const activeEndpoint = settings?.proxies[settings.activeMode];
  const hasActiveProxy = Boolean(activeEndpoint?.host && activeEndpoint.port);
  const canDeleteProfile = Boolean(profilesState && profilesState.profiles.length > 1 && selectedProfile);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <img className="brand-mark" src="/icon-48.png" alt="" />
          <div>
            <strong>Proxy Manager</strong>
            <small>Manifest V3</small>
          </div>
        </div>
        <nav>
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={section.id === activeSection ? 'active' : ''}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <StatusBanner tone={status.tone}>{status.message}</StatusBanner>

        {activeSection === 'proxy' && selectedProfile && settings ? (
          <section className="panel">
            <SectionHeader
              title="Proxy"
              description="Manage saved proxy profiles. The active profile is the one applied by Chrome."
            />

            <section className="profile-card" aria-label="Profile management">
              <div className="profile-switcher" role="group" aria-label="Profiles">
                {profilesState?.profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={`profile-chip${profile.id === selectedProfile.id ? ' selected' : ''}`}
                    aria-pressed={profile.id === selectedProfile.id}
                    disabled={busy}
                    onClick={() => void selectProfile(profile.id)}
                  >
                    <span className={`profile-dot${profile.settings.enabled ? ' on' : ''}`} aria-hidden />
                    <span className="profile-chip-name" title={profile.name}>
                      {profile.name.trim() || 'Untitled Profile'}
                    </span>
                  </button>
                ))}
                <button type="button" className="profile-chip profile-chip-add" disabled={busy} onClick={() => void createProfile()}>
                  + New profile
                </button>
              </div>
              <p className="profile-hint">Switching a profile applies it in Chrome right away. The dot shows whether the profile enables its proxy.</p>
              <div className="profile-row">
                <Field
                  label="Profile name"
                  value={selectedProfile.name}
                  maxLength={64}
                  onChange={(event) => updateSelectedProfile((profile) => ({ ...profile, name: event.target.value }))}
                />
                <div className="actions profile-actions">
                  <Button disabled={busy || !selectedProfile} onClick={() => void duplicateProfile()}>
                    Duplicate
                  </Button>
                  <Button variant="danger" disabled={busy || !canDeleteProfile} onClick={() => void deleteProfile()}>
                    Delete
                  </Button>
                </div>
              </div>
            </section>

            <div className="control-grid">
              <SegmentedControl
                label="Active mode"
                value={settings.activeMode}
                options={[
                  { value: 'http', label: 'HTTP' },
                  { value: 'https', label: 'HTTPS' },
                  { value: 'socks', label: 'SOCKS' },
                ]}
                onChange={(value) => updateProfileSettings({ activeMode: value })}
              />
              <SegmentedControl
                label="Proxy mode"
                value={settings.proxyMode}
                options={[
                  { value: 'singleProxy', label: 'Single proxy' },
                  { value: 'perProtocol', label: 'Per protocol' },
                ]}
                onChange={(value) => updateProfileSettings({ proxyMode: value })}
              />
              <SegmentedControl
                label="SOCKS"
                value={settings.socksVersion}
                options={[
                  { value: 'socks4', label: 'SOCKS4' },
                  { value: 'socks5', label: 'SOCKS5' },
                ]}
                onChange={(value: SocksVersion) => updateProfileSettings({ socksVersion: value })}
              />
            </div>

            <ProxyFields mode="http" title="HTTP Proxy" profile={selectedProfile} errors={errorsByField} onChange={updateProxy} />
            <ProxyFields mode="https" title="HTTPS Proxy" profile={selectedProfile} errors={errorsByField} onChange={updateProxy} />
            <ProxyFields mode="socks" title="SOCKS Proxy" profile={selectedProfile} errors={errorsByField} onChange={updateProxy} />

            <div className="actions">
              <Button
                variant="primary"
                disabled={busy || !validateProfileSettings({ ...settings, enabled: true }).valid}
                onClick={() => void saveSelectedProfile({ enable: true, successMessage: 'saved and enabled.' })}
              >
                Save
              </Button>
              <Button disabled={busy || !hasActiveProxy} onClick={() => void checkConnection()}>
                Check Connection
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => void disableProxy()}>
                Disable Proxy
              </Button>
            </div>
          </section>
        ) : null}

        {activeSection === 'rules' && selectedProfile ? (
          <section className="panel">
            <SectionHeader
              title="Bypass Rules"
              description={`Sites, IPs, CIDR ranges, and domain patterns that bypass ${selectedProfile.name}.`}
            />
            <TextAreaField
              label="Bypass list"
              value={selectedProfile.settings.bypassListRaw}
              rows={7}
              onChange={(event) => updateProfileSettings({ bypassListRaw: event.target.value })}
              error={errorsByField.get('bypassListRaw')}
              hint="Comma-separated. Examples: <local>, 192.168.0.0/16, *.example.com, example.com:99"
            />
            <div className="preview-box">
              <strong>Normalized preview</strong>
              <code>{bypassPreview.rules.length ? bypassPreview.rules.join(', ') : 'No valid rules yet'}</code>
            </div>
            <div className="actions">
              <Button variant="primary" disabled={busy || !validation.valid} onClick={() => void saveSelectedProfile()}>
                Save
              </Button>
            </div>
          </section>
        ) : null}

        {activeSection === 'auth' && selectedProfile ? (
          <section className="panel">
            <SectionHeader
              title="Authentication"
              description={`Credentials are saved only for ${selectedProfile.name}.`}
            />
            <div className="form-grid">
              <Field
                label="Username"
                value={selectedProfile.credentials.username}
                onChange={(event) =>
                  updateSelectedProfile((profile) => ({
                    ...profile,
                    credentials: { ...profile.credentials, username: event.target.value },
                  }))
                }
              />
              <Field
                label="Password"
                type="password"
                value={selectedProfile.credentials.password}
                onChange={(event) =>
                  updateSelectedProfile((profile) => ({
                    ...profile,
                    credentials: { ...profile.credentials, password: event.target.value },
                  }))
                }
              />
            </div>
            <div className="actions">
              <Button variant="primary" disabled={busy} onClick={() => void saveSelectedProfile({ successMessage: 'credentials saved.' })}>
                Save Credentials
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => void clearCredentials()}>
                Clear Credentials
              </Button>
            </div>
          </section>
        ) : null}

        {activeSection === 'about' ? (
          <section className="panel">
            <SectionHeader title="About" description="Chrome Manifest V3 extension for browser proxy profile management." />
            <div className="info-grid">
              <div>
                <strong>Permissions</strong>
                <p>proxy, storage, webRequest, webRequestAuthProvider, and host permissions for auth challenges.</p>
              </div>
              <div>
                <strong>Manifest V3</strong>
                <p>The service worker may be suspended by Chrome; the active profile is reapplied when the background starts.</p>
              </div>
              <div>
                <strong>Connection check</strong>
                <p>Best-effort check using the currently applied Chrome proxy configuration.</p>
              </div>
            </div>
            <div className="actions">
              <Button disabled={!profilesState} onClick={handleExport}>
                Export JSON
              </Button>
              <Button onClick={() => importInputRef.current?.click()}>Import JSON</Button>
              <Button variant="danger" disabled={busy} onClick={() => void resetSettings()}>
                Reset Profiles
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(event) => void handleImport(event.target.files?.[0])}
              />
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function ProxyFields({
  mode,
  title,
  profile,
  errors,
  onChange,
}: {
  mode: ActiveProxyMode;
  title: string;
  profile: ProxyProfile;
  errors: Map<string, string>;
  onChange: (mode: ActiveProxyMode, field: 'host' | 'port', value: string) => void;
}) {
  const endpoint = profile.settings.proxies[mode];
  const hostValidation = validateHost(endpoint.host);
  const portValidation = validatePort(endpoint.port);
  const hostError = endpoint.host && !hostValidation.valid ? hostValidation.message : errors.get(`proxies.${mode}.host`);
  const portError = endpoint.port && !portValidation.valid ? portValidation.message : errors.get(`proxies.${mode}.port`);

  return (
    <section className="proxy-card">
      <div>
        <h2>{title}</h2>
        <p>{mode === 'socks' ? `Using ${profile.settings.socksVersion}` : `Scheme: ${mode}`}</p>
      </div>
      <div className="form-grid">
        <Field label="Host" value={endpoint.host} error={hostError} onChange={(event) => onChange(mode, 'host', event.target.value)} />
        <Field label="Port" inputMode="numeric" value={endpoint.port} error={portError} onChange={(event) => onChange(mode, 'port', event.target.value)} />
      </div>
    </section>
  );
}

function getProfileStatus(profile: ProxyProfile): string {
  if (profile.lastError) {
    return profile.lastError;
  }

  return profile.settings.enabled ? `${profile.name} is enabled.` : `${profile.name} is disabled.`;
}
