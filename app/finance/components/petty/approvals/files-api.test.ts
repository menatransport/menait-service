import { describe, expect, test } from 'bun:test';
import { countByFolder } from './files-api';

describe('countByFolder', () => {
  test('counts files per spec folder', () => {
    expect(countByFolder([
      { key: 'a', url: '#', folder: 'receipt' },
      { key: 'b', url: '#', folder: 'receipt' },
      { key: 'c', url: '#', folder: 'transfer' },
    ])).toEqual({ receipt: 2, transfer: 1 });
  });
  test('empty list = no counts', () => expect(countByFolder([])).toEqual({}));
});
