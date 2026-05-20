/**
 * Tests for `parseFolderIdFromInput` — accepts either a bare Drive
 * folder ID or one of the several URL shapes Drive emits.
 */
import { describe, it, expect } from 'vitest';
import { parseFolderIdFromInput } from '../driveFolderSettingsService';

describe('parseFolderIdFromInput', () => {
  const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz';

  it('passes a bare ID through', () => {
    expect(parseFolderIdFromInput(ID)).toBe(ID);
  });

  it('extracts from the "share" URL form', () => {
    expect(
      parseFolderIdFromInput(`https://drive.google.com/drive/folders/${ID}?usp=sharing`),
    ).toBe(ID);
  });

  it('extracts from the /drive/u/0/folders/ variant', () => {
    expect(
      parseFolderIdFromInput(`https://drive.google.com/drive/u/0/folders/${ID}`),
    ).toBe(ID);
  });

  it('extracts from the open?id= variant', () => {
    expect(parseFolderIdFromInput(`https://drive.google.com/open?id=${ID}`)).toBe(ID);
  });

  it('trims whitespace around the input', () => {
    expect(parseFolderIdFromInput(`   ${ID}   `)).toBe(ID);
  });

  it('returns empty string for empty input', () => {
    expect(parseFolderIdFromInput('')).toBe('');
    expect(parseFolderIdFromInput('   ')).toBe('');
  });

  it('passes short non-id strings through unchanged (let CF reject)', () => {
    expect(parseFolderIdFromInput('oops')).toBe('oops');
  });
});
