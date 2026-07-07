import { describe, expect, it } from 'vitest';
import { expandBypassRulesForChrome, parseBypassRules } from './bypassRules';

describe('parseBypassRules', () => {
  it('splits comma separated rules and trims empty entries', () => {
    expect(parseBypassRules(' <local>,, *.example.com , example.com:99 ').rules).toEqual([
      '<local>',
      '*.example.com',
      'example.com:99',
    ]);
  });

  it('accepts cidr, wildcard domains, host ports, and local token', () => {
    const result = parseBypassRules('<local>, 192.168.0.0/16, *.example.com, example.com:99');

    expect(result.errors).toEqual([]);
    expect(result.rules).toEqual(['<local>', '192.168.0.0/16', '*.example.com', 'example.com:99']);
  });

  it('rejects schemes, paths, invalid cidr, and invalid ports', () => {
    const result = parseBypassRules('https://example.com, example.com/path, 192.168.0.0/99, example.com:70000');

    expect(result.rules).toEqual([]);
    expect(result.errors.map((error) => error.value)).toEqual([
      'https://example.com',
      'example.com/path',
      '192.168.0.0/99',
      'example.com:70000',
    ]);
  });
});

describe('expandBypassRulesForChrome', () => {
  it('adds a wildcard twin for bare domains so subdomains bypass too', () => {
    expect(expandBypassRulesForChrome(['example.com'])).toEqual(['example.com', '*.example.com']);
  });

  it('expands host:port rules with the port preserved', () => {
    expect(expandBypassRulesForChrome(['example.com:8080'])).toEqual(['example.com:8080', '*.example.com:8080']);
  });

  it('keeps local token, wildcards, IPs, and CIDR ranges untouched', () => {
    expect(expandBypassRulesForChrome(['<local>', '*.example.com', '10.0.0.1', '192.168.0.0/16', '::1'])).toEqual([
      '<local>',
      '*.example.com',
      '10.0.0.1',
      '192.168.0.0/16',
      '::1',
    ]);
  });

  it('does not duplicate a wildcard the user already listed', () => {
    expect(expandBypassRulesForChrome(['example.com', '*.example.com'])).toEqual(['example.com', '*.example.com']);
  });
});
