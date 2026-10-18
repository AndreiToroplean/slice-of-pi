import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { installDialogs, uninstallDialogs } from '../../../testing/fake-dialogs';
import { installPopovers, uninstallPopovers } from '../../../testing/fake-popovers';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { LUNA } from '../../game/grouping/break-models/luna';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { INDEXED_DB, IS_PREVIEW, RunStore } from '../../player-data/run-store';
import { FitToGroupingsDialog } from './fit-to-groupings-dialog';
import { loadMyGroupings, saveMyGroupings } from './my-groupings';

describe('FitToGroupingsDialog', () => {
  beforeEach(() => {
    installDialogs();
    installPopovers();
  });
  afterEach(() => {
    uninstallDialogs();
    uninstallPopovers();
  });

  /** A run of 30 digits typed about 200 ms apart, with a long pause before every 6th and a shorter one between. */
  function run(): number[] {
    let time = 0;
    return Array.from({ length: 30 }, (_, i) => {
      if (i > 0) {
        time += i % 6 === 0 ? 1200 : i % 3 === 0 ? 450 : ([180, 200, 230][i % 2] ?? 0);
      }
      return time;
    });
  }

  /** The first 30 decimals in groups of `size`. */
  function groupedBy(size: number): string {
    return (PI_DECIMALS.slice(0, 30).match(new RegExp(`.{1,${String(size)}}`, 'g')) ?? []).join(
      ' ',
    );
  }

  async function setUp(stored = ''): Promise<{ host: HTMLElement; detect: () => void }> {
    TestBed.configureTestingModule({
      providers: [
        { provide: IS_PREVIEW, useValue: false },
        { provide: INDEXED_DB, useValue: new IDBFactory() },
      ],
    });
    await TestBed.inject(DeveloperMode).set(true);
    await TestBed.inject(Tweaks).loaded;
    await saveMyGroupings(TestBed.inject(RunStore), stored);
    const fixture = TestBed.createComponent(FitToGroupingsDialog);
    fixture.componentRef.setInput('runs', [run(), run(), run(), run()]);
    fixture.detectChanges();
    await fixture.componentInstance.open();
    fixture.detectChanges();
    return {
      host: fixture.nativeElement as HTMLElement,
      detect: () => {
        fixture.detectChanges();
      },
    };
  }

  function field(host: HTMLElement, selector: string): HTMLElement {
    const found = host.querySelector<HTMLElement>(selector);
    if (found === null) {
      throw new Error(`No ${selector}`);
    }
    return found;
  }

  function status(host: HTMLElement): string {
    return field(host, '.status').textContent.trim();
  }

  function fitButton(host: HTMLElement): HTMLButtonElement {
    return field(host, 'button.end-fit') as HTMLButtonElement;
  }

  function type(host: HTMLElement, text: string): void {
    const textarea = field(host, 'textarea') as HTMLTextAreaElement;
    textarea.value = text;
    textarea.dispatchEvent(new Event('input'));
  }

  it('opens with the groupings typed last, and how well the model matches them', async () => {
    const { host } = await setUp(groupedBy(3));

    expect((field(host, 'textarea') as HTMLTextAreaElement).value).toBe(groupedBy(3));
    expect(status(host)).toMatch(/^Now: F1 \d\.\d\d\. \d+ of 9 breaks matched, \d+ extra\.$/);
  });

  it('draws the run-count curve of the model as set, as it opens', async () => {
    const { host, detect } = await setUp(groupedBy(3));
    await vi.waitFor(() => {
      detect();
      expect(host.querySelector('.spinner')).toBeNull();
    });

    expect(field(host, '.curve h3').textContent).toBe(
      `Run-count curve of ${TestBed.inject(Tweaks).breakModelKind().label}`,
    );
    expect(field(host, '.curve .caption').textContent).toMatch(
      /^F1 from 0 to 1 .*: \d\.\d\d with 1 run, \d\.\d\d with all 4\.$/,
    );
  });

  it('takes only digits and spaces, and keeps them', async () => {
    const { host, detect } = await setUp();
    type(host, '14a15, 926');
    detect();

    expect((field(host, 'textarea') as HTMLTextAreaElement).value).toBe('1415 926');
    await vi.waitFor(async () => {
      expect(await loadMyGroupings(TestBed.inject(RunStore))).toBe('1415 926');
    });
  });

  it('says where the groupings aren’t π, and doesn’t fit them', async () => {
    const { host, detect } = await setUp();
    type(host, '1415 927');
    detect();

    expect(status(host)).toBe('At place 7, π goes …15926.');
    expect(field(host, '.status u').textContent).toBe('6');
    expect(fitButton(host).getAttribute('disabled')).not.toBeNull();
    expect(field(host, 'textarea').getAttribute('aria-invalid')).toBe('true');
  });

  it('switches the break model', async () => {
    const { host, detect } = await setUp(groupedBy(3));
    (field(host, '.picker') as HTMLButtonElement).click();
    const luna = Array.from(host.querySelectorAll<HTMLButtonElement>('.model')).find((button) =>
      button.textContent.includes(LUNA.label),
    );
    luna?.click();
    detect();

    expect(TestBed.inject(Tweaks).breakModelKind()).toBe(LUNA);
    expect(field(host, '.picker').textContent.trim()).toBe(LUNA.label);
  });

  it('fits the model to the groupings, sets the sliders and draws their run-count curve', async () => {
    const { host, detect } = await setUp(groupedBy(3));
    // The quickest model, so that the test is.
    await TestBed.inject(Tweaks).setBreakModel(LUNA);
    detect();
    const before = Number(/F1 (\S+)\./.exec(status(host))?.[1]);
    fitButton(host).click();
    detect();

    expect(fitButton(host).disabled).toBe(true);
    expect(status(host)).toMatch(
      /^Refining your values until they settle, pass 1: best F1 \d\.\d\d so far\.$/,
    );
    await vi.waitFor(
      () => {
        detect();
        expect(fitButton(host).textContent.trim()).toBe('Fitted');
        expect(host.querySelector('.spinner')).toBeNull();
      },
      { timeout: 30_000, interval: 20 },
    );
    expect(TestBed.inject(Tweaks).values().grouping?.[LUNA.id]).toBeDefined();
    // How well the model, as now set, matches them.
    expect(Number(/F1 (\S+)\./.exec(status(host))?.[1])).toBeGreaterThan(before);
    // The dialog stays open on the curve, and the same fit can't be run again.
    expect((field(host, 'dialog') as HTMLDialogElement).open).toBe(true);
    expect(field(host, '.curve h3').textContent).toBe(`Run-count curve of ${LUNA.label}`);
    expect(field(host, '.curve .caption').textContent).toMatch(/with all 4\.$/);
    expect(fitButton(host).disabled).toBe(true);
    // Until the groupings change: then they can be fitted again, the last curve still shown.
    type(host, groupedBy(5));
    detect();
    expect(fitButton(host).disabled).toBe(false);
    expect(fitButton(host).textContent.trim()).toBe('Fit');
    expect(field(host, '.curve h3').textContent).toBe(`Run-count curve of ${LUNA.label}`);
  }, 40_000);

  it('fits the run-count curve, with fewer runs too, and can still fit with all of them', async () => {
    const { host, detect } = await setUp(groupedBy(3));
    await TestBed.inject(Tweaks).setBreakModel(LUNA);
    await TestBed.inject(Tweaks).togglePin(LUNA, 'window');
    detect();
    const curveButton = field(host, 'button.curve-fit') as HTMLButtonElement;
    curveButton.click();
    detect();

    expect(status(host)).toMatch(
      /^Refining your values until they settle, pass 1: best score \d\.\d\d so far, of F1 with all runs and fewer\.$/,
    );
    await vi.waitFor(
      () => {
        detect();
        expect(curveButton.textContent.trim()).toBe('Curve Fitted');
        expect(host.querySelector('.spinner')).toBeNull();
      },
      { timeout: 30_000, interval: 20 },
    );
    expect(curveButton.disabled).toBe(true);
    expect(fitButton(host).disabled).toBe(false);
    expect(fitButton(host).textContent.trim()).toBe('Fit');
    // Pinned on Your Runs, so left where it was.
    expect(TestBed.inject(Tweaks).grouping()['window']).toBe(LUNA.defaults['window']);
  }, 40_000);

  it('stops fitting when closed, leaving the hyperparameters as they were', async () => {
    const { host, detect } = await setUp(groupedBy(6));
    fitButton(host).click();
    detect();
    (field(host, '.buttons button') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      detect();
      expect(fitButton(host).disabled).toBe(false);
    });

    expect(TestBed.inject(Tweaks).values().grouping).toBeUndefined();
  });
});
