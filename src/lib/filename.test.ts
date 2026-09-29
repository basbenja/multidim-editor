import { describe, expect, it } from 'vitest';
import { cleanDocName } from './filename';

describe('cleanDocName', () => {
  it('keeps ordinary names, including spaces and accents', () => {
    expect(cleanDocName('Northwind DW – versión 2')).toBe('Northwind DW – versión 2');
  });

  it('drops a typed extension', () => {
    expect(cleanDocName('northwind.json')).toBe('northwind');
    expect(cleanDocName('northwind.PNG')).toBe('northwind');
  });

  it('replaces characters file systems reject and trims', () => {
    expect(cleanDocName('  sales/2024: v1?  ')).toBe('sales-2024- v1-');
    expect(cleanDocName('..hidden')).toBe('hidden');
  });

  it('falls back to "diagram" when empty', () => {
    expect(cleanDocName('')).toBe('diagram');
    expect(cleanDocName('  .json ')).toBe('diagram');
  });
});
