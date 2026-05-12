import { parseBypassRules } from './bypassRules';
import { DEFAULT_SETTINGS, type ActiveProxyMode, type ProxyMode, type ProxySettings, type SocksVersion } from './settings';
import { validateSettings } from './validation';

export type ImportSettingsResult = { ok: true; settings: ProxySettings } | { ok: false; error: string };

type ExportableSettings = Omit<ProxySettings, 'credentials' | 'lastAppliedAt' | 'lastError'>;

export function exportSettings(settings: ProxySettings): string {
  const exportable: ExportableSettings = {
    enabled: settings.enabled,
    activeMode: settings.activeMode,
    proxyMode: settings.proxyMode,
    proxies: settings.proxies,
    socksVersion: settings.socksVersion,
    bypassListRaw: settings.bypassListRaw,
    bypassList: settings.bypassList,
  };

  return JSON.stringify(exportable, null, 2);
}

export function importSettings(json: string): ImportSettingsResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Import file is not valid JSON.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'Import file must contain a settings object.' };
  }

  const settings = mergeSettings(parsed);
  const validation = validateSettings(settings);

  if (!validation.valid) {
    return {
      ok: false,
      error: validation.errors.map((error) => error.message).join(' '),
    };
  }

  return { ok: true, settings };
}

function mergeSettings(value: Record<string, unknown>): ProxySettings {
  const bypassListRaw = typeof value.bypassListRaw === 'string' ? value.bypassListRaw : DEFAULT_SETTINGS.bypassListRaw;
  const parsedBypass = parseBypassRules(bypassListRaw);

  return {
    ...DEFAULT_SETTINGS,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SETTINGS.enabled,
    activeMode: isActiveMode(value.activeMode) ? value.activeMode : DEFAULT_SETTINGS.activeMode,
    proxyMode: isProxyMode(value.proxyMode) ? value.proxyMode : DEFAULT_SETTINGS.proxyMode,
    socksVersion: isSocksVersion(value.socksVersion) ? value.socksVersion : DEFAULT_SETTINGS.socksVersion,
    proxies: {
      http: readEndpoint(value, 'http'),
      https: readEndpoint(value, 'https'),
      socks: readEndpoint(value, 'socks'),
    },
    bypassListRaw,
    bypassList: parsedBypass.rules,
    credentials: DEFAULT_SETTINGS.credentials,
  };
}

function readEndpoint(value: Record<string, unknown>, key: ActiveProxyMode) {
  const proxies = isRecord(value.proxies) ? value.proxies : {};
  const endpoint = isRecord(proxies[key]) ? proxies[key] : {};
  const fallback = DEFAULT_SETTINGS.proxies[key];

  return {
    host: typeof endpoint.host === 'string' ? endpoint.host : fallback.host,
    port: typeof endpoint.port === 'string' ? endpoint.port : fallback.port,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isActiveMode(value: unknown): value is ActiveProxyMode {
  return value === 'http' || value === 'https' || value === 'socks';
}

function isProxyMode(value: unknown): value is ProxyMode {
  return value === 'singleProxy' || value === 'perProtocol';
}

function isSocksVersion(value: unknown): value is SocksVersion {
  return value === 'socks4' || value === 'socks5';
}
