import { useEffect, useMemo, useRef, useState } from 'react';
import { parseBypassRules } from '../../src/core/bypassRules';
import { exportSettings, importSettings } from '../../src/core/importExport';
import { DEFAULT_SETTINGS, type ActiveProxyMode, type ProxySettings, type SocksVersion } from '../../src/core/settings';
import { validateHost, validatePort, validateSettings } from '../../src/core/validation';
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
  const [settings, setSettings] = useState<ProxySettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<{ tone: 'info' | 'success' | 'error' | 'warning'; message: string }>({
    tone: 'info',
    message: 'Loading settings...',
  });
  const [busy, setBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const validation = useMemo(() => validateSettings(settings), [settings]);
  const bypassPreview = useMemo(() => parseBypassRules(settings.bypassListRaw), [settings.bypassListRaw]);
  const errorsByField = useMemo(() => {
    return new Map(validation.errors.map((error) => [error.field, error.message]));
  }, [validation.errors]);

  useEffect(() => {
    void loadState();
  }, []);

  async function loadState() {
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'GET_STATE' });
    if (response.ok) {
      setSettings(response.data.settings);
      setStatus({ tone: 'info', message: response.data.settings.enabled ? 'Proxy is enabled.' : 'Proxy is disabled.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function saveProxySettings(nextSettings = settings, options: { enable?: boolean } = {}) {
    const settingsToSave = options.enable === undefined ? nextSettings : { ...nextSettings, enabled: options.enable };

    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'SAVE_SETTINGS', settings: settingsToSave });
    setBusy(false);

    if (response.ok) {
      setSettings(response.data.settings);
      setStatus({ tone: 'success', message: 'Settings and credentials saved and applied.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function disableProxy() {
    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'DISABLE_PROXY' });
    setBusy(false);

    if (response.ok) {
      setSettings(response.data.settings);
      setStatus({ tone: 'success', message: 'Proxy disabled.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function checkConnection() {
    const settingsToCheck = { ...settings, enabled: true };
    const currentValidation = validateSettings(settingsToCheck);

    if (!currentValidation.valid) {
      setStatus({ tone: 'error', message: currentValidation.errors.map((error) => error.message).join(' ') });
      return;
    }

    setBusy(true);
    setStatus({ tone: 'info', message: 'Saving and applying current configuration before check...' });
    const saveResponse = await sendRuntimeMessage<ExtensionState>({ type: 'SAVE_SETTINGS', settings: settingsToCheck });

    if (!saveResponse.ok) {
      setBusy(false);
      setStatus({ tone: 'error', message: saveResponse.error });
      return;
    }

    setSettings(saveResponse.data.settings);
    if (saveResponse.data.settings.lastError) {
      setBusy(false);
      setStatus({ tone: 'error', message: saveResponse.data.settings.lastError });
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

  async function saveCredentials() {
    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({
      type: 'SAVE_CREDENTIALS',
      credentials: settings.credentials,
    });
    setBusy(false);

    if (response.ok) {
      setSettings(response.data.settings);
      setStatus({ tone: 'success', message: 'Credentials saved locally.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function clearCredentials() {
    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'CLEAR_CREDENTIALS' });
    setBusy(false);

    if (response.ok) {
      setSettings(response.data.settings);
      setStatus({ tone: 'success', message: 'Credentials cleared.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function resetSettings() {
    if (!confirm('Reset all settings and credentials?')) {
      return;
    }

    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'RESET_SETTINGS' });
    setBusy(false);

    if (response.ok) {
      setSettings(response.data.settings);
      setStatus({ tone: 'success', message: 'Settings reset to defaults.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  function updateSettings(patch: Partial<ProxySettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function updateProxy(mode: ActiveProxyMode, field: 'host' | 'port', value: string) {
    setSettings((current) => ({
      ...current,
      proxies: {
        ...current.proxies,
        [mode]: {
          ...current.proxies[mode],
          [field]: value,
        },
      },
    }));
  }

  function handleExport() {
    const blob = new Blob([exportSettings(settings)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'chrome-proxy-manager-settings.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File | undefined) {
    if (!file) {
      return;
    }

    const result = importSettings(await file.text());
    if (!result.ok) {
      setStatus({ tone: 'error', message: result.error });
      return;
    }

    setSettings(result.settings);
    setStatus({ tone: 'success', message: 'Settings imported. Click "Save" to apply.' });
  }

  const activeEndpoint = settings.proxies[settings.activeMode];
  const hasActiveProxy = activeEndpoint.host && activeEndpoint.port;

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

        {activeSection === 'proxy' ? (
          <section className="panel">
            <SectionHeader
              title="Proxy"
              description="Configure HTTP, HTTPS, and SOCKS proxies. In singleProxy mode, the selected active mode is used."
            />

            <div className="control-grid">
              <SegmentedControl
                label="Active mode"
                value={settings.activeMode}
                options={[
                  { value: 'http', label: 'HTTP' },
                  { value: 'https', label: 'HTTPS' },
                  { value: 'socks', label: 'SOCKS' },
                ]}
                onChange={(value) => updateSettings({ activeMode: value })}
              />
              <SegmentedControl
                label="Proxy mode"
                value={settings.proxyMode}
                options={[
                  { value: 'singleProxy', label: 'Single proxy' },
                  { value: 'perProtocol', label: 'Per protocol' },
                ]}
                onChange={(value) => updateSettings({ proxyMode: value })}
              />
              <SegmentedControl
                label="SOCKS"
                value={settings.socksVersion}
                options={[
                  { value: 'socks4', label: 'SOCKS4' },
                  { value: 'socks5', label: 'SOCKS5' },
                ]}
                onChange={(value: SocksVersion) => updateSettings({ socksVersion: value })}
              />
            </div>

            <ProxyFields mode="http" title="HTTP Proxy" settings={settings} errors={errorsByField} onChange={updateProxy} />
            <ProxyFields mode="https" title="HTTPS Proxy" settings={settings} errors={errorsByField} onChange={updateProxy} />
            <ProxyFields mode="socks" title="SOCKS Proxy" settings={settings} errors={errorsByField} onChange={updateProxy} />

            <div className="actions">
              <Button variant="primary" disabled={busy || !validateSettings({ ...settings, enabled: true }).valid} onClick={() => void saveProxySettings(settings, { enable: true })}>
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

        {activeSection === 'rules' ? (
          <section className="panel">
            <SectionHeader
              title="Bypass Rules"
              description="Sites, IPs, CIDR ranges, and domain patterns that bypass the proxy."
            />
            <TextAreaField
              label="Bypass list"
              value={settings.bypassListRaw}
              rows={7}
              onChange={(event) => updateSettings({ bypassListRaw: event.target.value })}
              error={errorsByField.get('bypassListRaw')}
              hint="Comma-separated. Examples: <local>, 192.168.0.0/16, *.example.com, example.com:99"
            />
            <div className="preview-box">
              <strong>Normalized preview</strong>
              <code>{bypassPreview.rules.length ? bypassPreview.rules.join(', ') : 'No valid rules yet'}</code>
            </div>
            <div className="actions">
              <Button variant="primary" disabled={busy || !validation.valid} onClick={() => void saveProxySettings()}>
                Save
              </Button>
            </div>
          </section>
        ) : null}

        {activeSection === 'auth' ? (
          <section className="panel">
            <SectionHeader
              title="Authentication"
              description="Credentials are applied by the background service worker on proxy auth challenges."
            />
            <div className="form-grid">
              <Field
                label="Username"
                value={settings.credentials.username}
                onChange={(event) =>
                  updateSettings({ credentials: { ...settings.credentials, username: event.target.value } })
                }
              />
              <Field
                label="Password"
                type="password"
                value={settings.credentials.password}
                onChange={(event) =>
                  updateSettings({ credentials: { ...settings.credentials, password: event.target.value } })
                }
              />
            </div>
            <div className="actions">
              <Button variant="primary" disabled={busy} onClick={() => void saveCredentials()}>
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
            <SectionHeader title="About" description="Chrome Manifest V3 extension for browser proxy management." />
            <div className="info-grid">
              <div>
                <strong>Permissions</strong>
                <p>proxy, storage, webRequest, webRequestAuthProvider, and host permissions for auth challenges.</p>
              </div>
              <div>
                <strong>Manifest V3</strong>
                <p>The service worker may be suspended by Chrome; settings are reapplied when the background starts.</p>
              </div>
              <div>
                <strong>Connection check</strong>
                <p>Best-effort check using the currently applied Chrome proxy configuration.</p>
              </div>
            </div>
            <div className="actions">
              <Button onClick={handleExport}>Export JSON</Button>
              <Button onClick={() => importInputRef.current?.click()}>Import JSON</Button>
              <Button variant="danger" disabled={busy} onClick={() => void resetSettings()}>
                Reset Settings
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
  settings,
  errors,
  onChange,
}: {
  mode: ActiveProxyMode;
  title: string;
  settings: ProxySettings;
  errors: Map<string, string>;
  onChange: (mode: ActiveProxyMode, field: 'host' | 'port', value: string) => void;
}) {
  const endpoint = settings.proxies[mode];
  const hostError = validateHost(endpoint.host).valid ? errors.get(`proxies.${mode}.host`) : validateHost(endpoint.host).message;
  const portError = validatePort(endpoint.port).valid ? errors.get(`proxies.${mode}.port`) : validatePort(endpoint.port).message;

  return (
    <section className="proxy-card">
      <div>
        <h2>{title}</h2>
        <p>{mode === 'socks' ? `Using ${settings.socksVersion}` : `Scheme: ${mode}`}</p>
      </div>
      <div className="form-grid">
        <Field label="Host" value={endpoint.host} error={hostError} onChange={(event) => onChange(mode, 'host', event.target.value)} />
        <Field label="Port" inputMode="numeric" value={endpoint.port} error={portError} onChange={(event) => onChange(mode, 'port', event.target.value)} />
      </div>
    </section>
  );
}
