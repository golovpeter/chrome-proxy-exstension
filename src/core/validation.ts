import { parseBypassRules } from './bypassRules';
import type { ActiveProxyMode, ProfileProxySettings, ProxyEndpoint, ProxySettings } from './settings';

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export interface FieldValidationError {
  field: string;
  message: string;
}

export interface SettingsValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
  warnings: FieldValidationError[];
}

export function validateHost(host: string): ValidationResult {
  const value = host.trim();

  if (!value) {
    return { valid: false, message: 'Host is required.' };
  }

  if (value.includes('://')) {
    return { valid: false, message: 'Enter a host without a URL scheme.' };
  }

  if (/[/?#]/.test(value)) {
    return { valid: false, message: 'Enter a host without paths, queries, or fragments.' };
  }

  if (/\s/.test(value)) {
    return { valid: false, message: 'Host cannot contain spaces.' };
  }

  if (isIpv4(value) || isLikelyIpv6(value) || isHostname(value)) {
    return { valid: true };
  }

  return { valid: false, message: 'Enter a valid domain name or IP address.' };
}

export function validatePort(port: string): ValidationResult {
  const value = port.trim();

  if (!/^\d+$/.test(value)) {
    return { valid: false, message: 'Port must be a number.' };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return { valid: false, message: 'Port must be from 1 to 65535.' };
  }

  return { valid: true };
}

export function validateProfileSettings(settings: ProfileProxySettings): SettingsValidationResult {
  const errors: FieldValidationError[] = [];
  const modes = settings.proxyMode === 'singleProxy' ? [settings.activeMode] : (['http', 'https', 'socks'] satisfies ActiveProxyMode[]);

  if (settings.enabled) {
    for (const mode of modes) {
      collectEndpointErrors(mode, settings.proxies[mode], errors);
    }
  }

  const bypass = parseBypassRules(settings.bypassListRaw);
  for (const error of bypass.errors) {
    errors.push({ field: 'bypassListRaw', message: `${error.value}: ${error.message}` });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

export function validateSettings(settings: ProxySettings): SettingsValidationResult {
  const result = validateProfileSettings(settings);
  const warnings = [...result.warnings];

  if (settings.enabled && !settings.credentials.username && settings.credentials.password) {
    warnings.push({ field: 'credentials.username', message: 'Username is empty while password is set.' });
  }

  return {
    ...result,
    warnings,
  };
}

function collectEndpointErrors(mode: ActiveProxyMode, endpoint: ProxyEndpoint, errors: FieldValidationError[]) {
  const host = validateHost(endpoint.host);
  const port = validatePort(endpoint.port);

  if (!host.valid) {
    errors.push({ field: `proxies.${mode}.host`, message: host.message ?? 'Invalid host.' });
  }

  if (!port.valid) {
    errors.push({ field: `proxies.${mode}.port`, message: port.message ?? 'Invalid port.' });
  }
}

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) {
        return false;
      }

      const number = Number(part);
      return number >= 0 && number <= 255;
    })
  );
}

function isLikelyIpv6(value: string): boolean {
  return value.includes(':') && /^[a-fA-F0-9:]+$/.test(value) && value.includes('::');
}

function isHostname(value: string): boolean {
  return /^(?!-)(?:[a-zA-Z0-9-]{1,63}\.)*[a-zA-Z0-9-]{1,63}$/.test(value) && !value.endsWith('-');
}
