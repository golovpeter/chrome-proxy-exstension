import { describe, expect, it } from 'vitest';
import { parseBypassRules } from './bypassRules';

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
