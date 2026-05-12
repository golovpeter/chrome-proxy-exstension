import { useEffect, useMemo, useRef, useState } from 'react';
import { parseBypassRules } from '../../src/core/bypassRules';
import { exportSettings, importSettings } from '../../src/core/importExport';
import { DEFAULT_SETTINGS, type ActiveProxyMode, type ProxySettings, type SocksVersion } from '../../src/core/settings';
import { validateHost, validatePort, validateSettings } from '../../src/core/validation';
import { sendRuntimeMessage, type ExtensionState } from '../../src/platform/messages';
import { Button, Field, SectionHeader, SegmentedControl, StatusBanner, TextAreaField } from '../../src/ui/components';

type SectionId = 'proxy' | 'rules' | 'auth' | 'about';

const sections: { id: SectionId; label: string }[] = [
  { id: 'proxy', label: 'Прокси' },
  { id: 'rules', label: 'Правила' },
  { id: 'auth', label: 'Аутентификация' },
  { id: 'about', label: 'О расширении' },
];

export function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('proxy');
  const [settings, setSettings] = useState<ProxySettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<{ tone: 'info' | 'success' | 'error' | 'warning'; message: string }>({
    tone: 'info',
    message: 'Загрузка настроек...',
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
      setStatus({ tone: 'info', message: response.data.settings.enabled ? 'Прокси включен.' : 'Прокси отключен.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function saveProxySettings(nextSettings = settings) {
    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'SAVE_SETTINGS', settings: nextSettings });
    setBusy(false);

    if (response.ok) {
      setSettings(response.data.settings);
      setStatus({ tone: 'success', message: 'Настройки и credentials сохранены и применены.' });
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
      setStatus({ tone: 'success', message: 'Прокси отключен.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function checkConnection() {
    setBusy(true);
    const response = await sendRuntimeMessage<{ ok: true } | { ok: false; error: string }>({ type: 'CHECK_CONNECTION' });
    setBusy(false);

    if (!response.ok) {
      setStatus({ tone: 'error', message: response.error });
      return;
    }

    setStatus(
      response.data.ok
        ? { tone: 'success', message: 'Проверка подключения прошла успешно.' }
        : { tone: 'warning', message: response.data.error },
    );
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
      setStatus({ tone: 'success', message: 'Credentials сохранены локально.' });
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
      setStatus({ tone: 'success', message: 'Credentials очищены.' });
    } else {
      setStatus({ tone: 'error', message: response.error });
    }
  }

  async function resetSettings() {
    if (!confirm('Сбросить настройки и credentials?')) {
      return;
    }

    setBusy(true);
    const response = await sendRuntimeMessage<ExtensionState>({ type: 'RESET_SETTINGS' });
    setBusy(false);

    if (response.ok) {
      setSettings(response.data.settings);
      setStatus({ tone: 'success', message: 'Настройки сброшены.' });
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
    setStatus({ tone: 'success', message: 'Настройки импортированы. Нажмите “Сохранить”, чтобы применить.' });
  }

  const activeEndpoint = settings.proxies[settings.activeMode];
  const hasActiveProxy = activeEndpoint.host && activeEndpoint.port;

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Основная навигация">
        <div className="brand">
          <span className="brand-mark">PM</span>
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
              title="Прокси"
              description="Настройте HTTP, HTTPS и SOCKS-прокси. В singleProxy используется выбранный активный режим."
            />

            <div className="control-grid">
              <SegmentedControl
                label="Состояние"
                value={settings.enabled ? 'enabled' : 'disabled'}
                options={[
                  { value: 'enabled', label: 'Enabled' },
                  { value: 'disabled', label: 'Disabled' },
                ]}
                onChange={(value) => updateSettings({ enabled: value === 'enabled' })}
              />
              <SegmentedControl
                label="Активный режим"
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
                  { value: 'singleProxy', label: 'singleProxy' },
                  { value: 'perProtocol', label: 'По протоколам' },
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

            <ProxyFields mode="http" title="HTTP-прокси" settings={settings} errors={errorsByField} onChange={updateProxy} />
            <ProxyFields mode="https" title="HTTPS-прокси" settings={settings} errors={errorsByField} onChange={updateProxy} />
            <ProxyFields mode="socks" title="SOCKS-прокси" settings={settings} errors={errorsByField} onChange={updateProxy} />

            <div className="actions">
              <Button variant="primary" disabled={busy || !validation.valid} onClick={() => void saveProxySettings()}>
                Сохранить
              </Button>
              <Button disabled={busy || !hasActiveProxy} onClick={() => void checkConnection()}>
                Проверить подключение
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => void disableProxy()}>
                Отключить прокси
              </Button>
            </div>
          </section>
        ) : null}

        {activeSection === 'rules' ? (
          <section className="panel">
            <SectionHeader
              title="Правила"
              description="Сайты, IP, CIDR и маски доменов, для которых прокси не используется."
            />
            <TextAreaField
              label="Whitelist / bypass list"
              value={settings.bypassListRaw}
              rows={7}
              onChange={(event) => updateSettings({ bypassListRaw: event.target.value })}
              error={errorsByField.get('bypassListRaw')}
              hint="Формат через запятую. Примеры: <local>, 192.168.0.0/16, *.example.com, example.com:99"
            />
            <div className="preview-box">
              <strong>Normalized preview</strong>
              <code>{bypassPreview.rules.length ? bypassPreview.rules.join(', ') : 'No valid rules yet'}</code>
            </div>
            <div className="actions">
              <Button variant="primary" disabled={busy || !validation.valid} onClick={() => void saveProxySettings()}>
                Сохранить
              </Button>
            </div>
          </section>
        ) : null}

        {activeSection === 'auth' ? (
          <section className="panel">
            <SectionHeader
              title="Аутентификация"
              description="Credentials применяются background service worker при proxy auth challenge."
            />
            <StatusBanner tone="warning">
              Пароль хранится в chrome.storage.local. Это локальное хранилище расширения, а не системный keychain.
            </StatusBanner>
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
                Сохранить credentials
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => void clearCredentials()}>
                Очистить credentials
              </Button>
            </div>
          </section>
        ) : null}

        {activeSection === 'about' ? (
          <section className="panel">
            <SectionHeader title="О расширении" description="Сборка Chrome Manifest V3 для управления browser proxy." />
            <div className="info-grid">
              <div>
                <strong>Permissions</strong>
                <p>proxy, storage, webRequest, webRequestAuthProvider, host permissions для auth challenge.</p>
              </div>
              <div>
                <strong>Manifest V3</strong>
                <p>Service worker может выгружаться Chrome; настройки повторно применяются при запуске background.</p>
              </div>
              <div>
                <strong>Connection check</strong>
                <p>Проверка best-effort и использует текущую примененную proxy-конфигурацию Chrome.</p>
              </div>
            </div>
            <div className="actions">
              <Button onClick={handleExport}>Экспорт JSON</Button>
              <Button onClick={() => importInputRef.current?.click()}>Импорт JSON</Button>
              <Button variant="danger" disabled={busy} onClick={() => void resetSettings()}>
                Сбросить настройки
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
        <p>{mode === 'socks' ? `Используется как ${settings.socksVersion}` : `Scheme: ${mode}`}</p>
      </div>
      <div className="form-grid">
        <Field label="Host" value={endpoint.host} error={hostError} onChange={(event) => onChange(mode, 'host', event.target.value)} />
        <Field label="Port" inputMode="numeric" value={endpoint.port} error={portError} onChange={(event) => onChange(mode, 'port', event.target.value)} />
      </div>
    </section>
  );
}
