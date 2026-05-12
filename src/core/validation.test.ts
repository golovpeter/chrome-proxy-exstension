import { describe, expect, it } from 'vitest';
import { validateHost, validatePort } from './validation';

describe('validateHost', () => {
  it('rejects empty hosts, schemes, and paths', () => {
    expect(validateHost('').valid).toBe(false);
    expect(validateHost('http://proxy.example.com').valid).toBe(false);
    expect(validateHost('proxy.example.com/path').valid).toBe(false);
  });

  it('accepts domain names and ip addresses', () => {
    expect(validateHost('proxy.example.com').valid).toBe(true);
    expect(validateHost('192.168.1.10').valid).toBe(true);
    expect(validateHost('2001:db8::1').valid).toBe(true);
  });
});

describe('validatePort', () => {
  it('accepts only integer ports from 1 to 65535', () => {
    expect(validatePort('1').valid).toBe(true);
    expect(validatePort('65535').valid).toBe(true);
    expect(validatePort('0').valid).toBe(false);
    expect(validatePort('65536').valid).toBe(false);
    expect(validatePort('abc').valid).toBe(false);
  });
});
