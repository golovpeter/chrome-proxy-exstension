export interface BypassRuleError {
  value: string;
  message: string;
}

export interface ParsedBypassRules {
  rules: string[];
  errors: BypassRuleError[];
}

export function parseBypassRules(raw: string): ParsedBypassRules {
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const rules: string[] = [];
  const errors: BypassRuleError[] = [];

  for (const value of values) {
    const error = validateBypassRule(value);

    if (error) {
      errors.push({ value, message: error });
    } else {
      rules.push(value);
    }
  }

  return { rules, errors };
}

export function expandBypassRulesForChrome(rules: string[]): string[] {
  const existing = new Set(rules);
  const expanded: string[] = [];

  for (const rule of rules) {
    expanded.push(rule);

    const wildcardTwin = bareDomainToWildcard(rule);
    if (wildcardTwin && !existing.has(wildcardTwin)) {
      existing.add(wildcardTwin);
      expanded.push(wildcardTwin);
    }
  }

  return expanded;
}

function bareDomainToWildcard(rule: string): string | null {
  if (rule === '<local>' || rule.includes('*') || rule.includes('/')) {
    return null;
  }

  const portResult = splitOptionalPort(rule);
  if (!portResult.valid) {
    return null;
  }

  const host = portResult.host;
  if (host.includes(':') || isValidIpv4(host) || !host.includes('.') || !isValidDomain(host)) {
    return null;
  }

  const port = rule.length > host.length ? rule.slice(host.length) : '';
  return `*.${host}${port}`;
}

function validateBypassRule(value: string): string | null {
  if (value === '<local>') {
    return null;
  }

  if (value.includes('://')) {
    return 'Use a host pattern without a URL scheme.';
  }

  if (value.includes('/')) {
    return isValidCidr(value) ? null : 'Use IPv4 CIDR with a prefix from 0 to 32.';
  }

  if (/[?#]/.test(value)) {
    return 'Use a host, IP, CIDR, or wildcard domain without paths.';
  }

  const portResult = splitOptionalPort(value);
  if (!portResult.valid) {
    return portResult.message;
  }

  return isValidHostPattern(portResult.host) ? null : 'Use a valid host, IP, or wildcard domain.';
}

function splitOptionalPort(value: string): { valid: true; host: string } | { valid: false; message: string } {
  const colonCount = [...value].filter((char) => char === ':').length;

  if (colonCount !== 1) {
    return { valid: true, host: value };
  }

  const [host, port] = value.split(':');

  if (!host || !port) {
    return { valid: false, message: 'Host and port are required when using host:port.' };
  }

  if (!isValidPort(port)) {
    return { valid: false, message: 'Port must be an integer from 1 to 65535.' };
  }

  return { valid: true, host };
}

function isValidCidr(value: string): boolean {
  const [address, prefix, extra] = value.split('/');

  if (!address || !prefix || extra !== undefined) {
    return false;
  }

  const prefixNumber = Number(prefix);
  if (!Number.isInteger(prefixNumber) || prefixNumber < 0 || prefixNumber > 32) {
    return false;
  }

  return isValidIpv4(address);
}

function isValidIpv4(value: string): boolean {
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

function isValidHostPattern(value: string): boolean {
  if (!value || /\s/.test(value)) {
    return false;
  }

  if (value.startsWith('*.')) {
    return isValidDomain(value.slice(2));
  }

  if (isValidIpv4(value)) {
    return true;
  }

  if (value.includes(':')) {
    return /^[a-fA-F0-9:]+$/.test(value) && value.includes('::');
  }

  return isValidDomain(value);
}

function isValidDomain(value: string): boolean {
  return /^(?!-)(?:[a-zA-Z0-9-]{1,63}\.)*[a-zA-Z0-9-]{1,63}$/.test(value) && !value.endsWith('-');
}

function isValidPort(value: string): boolean {
  if (!/^\d+$/.test(value)) {
    return false;
  }

  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}
