import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { IDBFactory } from 'fake-indexeddb';
import { CONFIRM } from '../app/data/confirm';
import { SAVE_FILE } from '../app/data/data';
import { DeveloperMode } from '../app/developer/developer-mode';
import { Run } from '../app/runs/run';
import { RUN_CLOCK } from '../app/runs/run-recorder';
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  INDEXED_DB,
  IS_PREVIEW,
  MAIN_FORMAT,
  META,
  RunStore,
  RUNS,
  STORAGE_MANAGER,
} from '../app/runs/run-store';

/** The player's data a page opens on, and what stands in for the player and the browser. */
export interface PageSetUp {
  readonly runs?: readonly Run[];
  /** Whether the browser keeps the storage safe from eviction. */
  readonly persisted?: boolean;
  /** Whether the page is served by a pull request preview. */
  readonly preview?: boolean;
  /** The run format the main game noted, if any. */
  readonly mainFormat?: number | undefined;
  readonly developer?: boolean;
  /** Answers the questions the player is asked to confirm. */
  readonly confirm?: (question: string) => boolean;
  /** Takes the files handed to the player. */
  readonly saveFile?: (name: string, text: string) => void;
}

/** An open page and a way to wait for the database to answer and the view to show it. */
export interface OpenPage {
  readonly host: HTMLElement;
  readonly until: (ready: () => boolean) => Promise<void>;
}

/**
 * Opens a page about the player's data on these runs and settings, in a database of its own, at noon on 10 October
 * 2026, once it's `ready` (such as once it shows the runs it read as it opened).
 */
export async function openPage(
  component: Type<unknown>,
  ready: (host: HTMLElement) => boolean,
  {
    runs = [],
    persisted = false,
    preview = false,
    mainFormat,
    developer = false,
    confirm = () => true,
    saveFile = () => undefined,
  }: PageSetUp = {},
): Promise<OpenPage> {
  const indexedDb = new IDBFactory();
  if (mainFormat !== undefined) {
    await noteMainFormat(indexedDb, mainFormat);
  }
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: INDEXED_DB, useValue: indexedDb },
      { provide: IS_PREVIEW, useValue: preview },
      {
        provide: STORAGE_MANAGER,
        useValue: { persisted: () => Promise.resolve(persisted) },
      },
      {
        provide: RUN_CLOCK,
        useValue: {
          now: () => 0,
          epoch: () => new Date(2026, 9, 10, 12).getTime(),
          newId: () => 'id',
        },
      },
      { provide: CONFIRM, useValue: confirm },
      { provide: SAVE_FILE, useValue: saveFile },
    ],
  });
  for (const run of runs) {
    await TestBed.inject(RunStore).save(run);
  }
  if (developer) {
    await TestBed.inject(DeveloperMode).set(true);
  }
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const until = (isReady: () => boolean): Promise<void> =>
    vi.waitFor(async () => {
      await fixture.whenStable();
      if (!isReady()) {
        throw new Error('Not ready yet');
      }
    });
  await until(() => ready(host));
  return { host, until };
}

/** Notes the main game's run format, as the main game does when it opens the database. */
function noteMainFormat(indexedDb: IDBFactory, format: number): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(RUNS, { keyPath: 'id' });
      request.result.createObjectStore(META);
    };
    request.onsuccess = () => {
      const transaction = request.result.transaction(META, 'readwrite');
      transaction.objectStore(META).put({ format }, MAIN_FORMAT);
      transaction.oncomplete = () => {
        request.result.close();
        resolve();
      };
    };
  });
}

/** The text of a page, its spaces collapsed. */
export function text(host: HTMLElement): string {
  return host.textContent.replace(/\s+/g, ' ').trim();
}

/** What the page last told the player, in its status message. */
export function message(host: HTMLElement): string | undefined {
  return host.querySelector('[role="status"]')?.textContent.trim();
}

export function button(host: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(host.querySelectorAll('button')).find(
    (candidate) => candidate.textContent.trim() === label,
  );
  if (found === undefined) {
    throw new Error(`No button "${label}"`);
  }
  return found;
}
