import { IDBFactory } from 'fake-indexeddb';
import { TestBed } from '@angular/core/testing';
import { Digit } from '../app/game/pi/digit';
import { PI_DECIMALS } from '../app/game/pi/pi-decimals';
import { Router } from '@angular/router';
import { INDEXED_DB, RunStore } from '../app/player-data/run-store';
import { newTouchLog } from '../app/player-data/touch-log';
import { typeKey } from './touch-logs';

/**
 * Unlocks the checkpoints up to a place, with a Discover run reaching it, which counts in no groups, in a database of its
 * own, and asks the next game to start from it, as the main menu does, in the route's query. Before anything reads the
 * runs.
 */
export async function startFrom(place: number): Promise<void> {
  await unlockTo(place);
  await TestBed.inject(Router).navigateByUrl(`/?from=${String(place)}`);
}

/**
 * Unlocks the checkpoints up to a place, with a Discover run reaching it, which counts in no groups, in a database of its
 * own. Before anything reads the runs.
 */
export async function unlockTo(place: number): Promise<void> {
  TestBed.overrideProvider(INDEXED_DB, { useValue: new IDBFactory() });
  await TestBed.inject(RunStore).save(
    Array.from(PI_DECIMALS.slice(0, place)).reduce(
      (log, digit, i) => typeKey(log, digit as Digit, i * 200),
      newTouchLog(`discovered-${String(place)}`, 0, true, 'calculator', { recording: 'overwrite' }),
    ),
  );
}
