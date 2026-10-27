import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { INDEXED_DB, IS_PREVIEW, RunStore } from '../../player-data/run-store';
import {
  firstMistake,
  groupsIn,
  loadMyGroupings,
  MY_GROUPINGS,
  onlyDigitsAndSpaces,
  saveMyGroupings,
} from './my-groupings';

describe('My groupings', () => {
  it('splits the groups at spaces, however many', () => {
    expect(groupsIn('  1415 926\n\n5358   979\t323 ')).toEqual([
      '1415',
      '926',
      '5358',
      '979',
      '323',
    ]);
    expect(groupsIn('   ')).toEqual([]);
  });

  it('keeps only digits and spaces', () => {
    expect(onlyDigitsAndSpaces('14a15, 9.26\n5')).toBe('1415 926\n5');
  });

  it('finds the first digit that isn’t π’s', () => {
    expect(firstMistake(['1415', '926', '5358'])).toBeUndefined();
    expect(firstMistake(['1415', '927', '5358'])).toEqual({
      place: 7,
      expected: '6',
      before: '1592',
    });
    expect(firstMistake(['24'])).toEqual({ place: 1, expected: '1', before: '' });
  });

  describe('kept', () => {
    function store(): RunStore {
      TestBed.configureTestingModule({
        providers: [
          { provide: IS_PREVIEW, useValue: false },
          { provide: INDEXED_DB, useValue: new IDBFactory() },
        ],
      });
      return TestBed.inject(RunStore);
    }

    it('are kept as typed', async () => {
      const runStore = store();
      await saveMyGroupings(runStore, '1415  926 ');

      expect(await loadMyGroupings(runStore)).toBe('1415  926 ');
    });

    it('are none where none or something else is stored', async () => {
      const runStore = store();

      expect(await loadMyGroupings(runStore)).toBe('');
      await runStore.saveSetting(MY_GROUPINGS, { format: 99, text: '1415' });
      expect(await loadMyGroupings(runStore)).toBe('');
    });
  });
});
