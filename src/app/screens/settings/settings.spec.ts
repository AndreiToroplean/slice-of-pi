import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { KeypadLayoutSetting } from '../../player-data/keypad-layout-setting';
import { INDEXED_DB } from '../../player-data/run-store';
import { Settings } from './settings';

describe('Settings', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: INDEXED_DB, useValue: undefined }],
    });
  });

  async function setUp(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function countdown(host: HTMLElement): HTMLInputElement | null {
    return host.querySelector<HTMLInputElement>('input[type="checkbox"]');
  }

  it('turns the countdown to the end of the group off and on, in developer mode', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    const host = await setUp();
    const tweaks = TestBed.inject(Tweaks);
    expect(countdown(host)?.closest('label')?.textContent).toContain('Countdown');
    expect(countdown(host)?.checked).toBe(true);

    countdown(host)?.click();
    expect(tweaks.countdown()).toBe(false);

    countdown(host)?.click();
    expect(tweaks.countdown()).toBe(true);
  });

  it('turns checking the digits off and on, in developer mode, and brings it back', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    const host = await setUp();
    const tweaks = TestBed.inject(Tweaks);
    const checking = Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).find((input) => input.closest('label')?.textContent.includes('Check Digits'));
    expect(checking?.checked).toBe(true);
    expect(backToDefault(host, 'Check Digits')?.disabled).toBe(true);

    checking?.click();
    expect(tweaks.checking()).toBe(false);

    await TestBed.inject(ApplicationRef).whenStable();
    backToDefault(host, 'Check Digits')?.click();
    expect(tweaks.checking()).toBe(true);
  });

  it('makes the keys see-through or solid, in developer mode, and brings back solid ones', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    const host = await setUp();
    const tweaks = TestBed.inject(Tweaks);
    expect(backToDefault(host, 'Clear Keys')?.disabled).toBe(true);

    button(host, 'Clear Keys')?.click();
    expect(tweaks.solidKeys()).toBe(false);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(button(host, 'Clear Keys')?.getAttribute('aria-checked')).toBe('true');

    backToDefault(host, 'Clear Keys')?.click();
    expect(tweaks.solidKeys()).toBe(true);
  });

  it("shows the player's data", async () => {
    const host = await setUp();

    expect(host.querySelector('app-your-data h2')?.textContent).toBe('Your Data');
  });

  it('picks the keypad layout', async () => {
    const host = await setUp();
    const layout = (name: string): HTMLButtonElement | undefined =>
      Array.from(host.querySelectorAll('[aria-label="Keypad layout"] [role="radio"]')).find(
        (radio): radio is HTMLButtonElement => radio.textContent.trim() === name,
      );
    expect(layout('Calculator')?.getAttribute('aria-checked')).toBe('true');

    layout('Telephone')?.click();

    expect(TestBed.inject(KeypadLayoutSetting).layout()).toBe('telephone');
  });

  function button(host: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(host.querySelectorAll('button')).find(
      (each) => each.title === label || each.textContent.trim() === label,
    );
  }

  /** The button bringing back the default value of the setting whose row says this. */
  function backToDefault(host: HTMLElement, setting: string): HTMLButtonElement | null {
    const row = Array.from(host.querySelectorAll('.row')).find((each) =>
      each.textContent.includes(setting),
    );
    return row?.querySelector<HTMLButtonElement>('button[title="Back to Default"]') ?? null;
  }

  it('brings back the default keypad layout, once it was changed', async () => {
    const setting = TestBed.inject(KeypadLayoutSetting);
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const revert = backToDefault(host, 'Calculator');
    expect(revert?.disabled).toBe(true);

    await setting.set('telephone');
    await fixture.whenStable();
    expect(revert?.disabled).toBe(false);
    revert?.click();

    expect(setting.layout()).toBe('calculator');
  });

  it('brings back the countdown, once it was turned off', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    const tweaks = TestBed.inject(Tweaks);
    await tweaks.setCountdown(false);
    const host = await setUp();

    backToDefault(host, 'Countdown')?.click();

    expect(tweaks.countdown()).toBe(true);
  });

  it('brings back every default value at once', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    const tweaks = TestBed.inject(Tweaks);
    const setting = TestBed.inject(KeypadLayoutSetting);
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(button(host, 'Reset Settings')?.disabled).toBe(true);

    await tweaks.setCountdown(false);
    await tweaks.setChecking(false);
    await tweaks.setSolidKeys(false);
    await setting.set('telephone');
    await fixture.whenStable();
    button(host, 'Reset Settings')?.click();

    expect(tweaks.solidKeys()).toBe(true);
    expect(tweaks.countdown()).toBe(true);
    expect(tweaks.checking()).toBe(true);
    expect(setting.layout()).toBe('calculator');
  });

  it('has no developer settings outside developer mode', async () => {
    const host = await setUp();

    expect(countdown(host)).toBeNull();
  });
});
