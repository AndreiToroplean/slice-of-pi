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

  it('picks the keypad layout', async () => {
    const host = await setUp();
    const layout = (name: string): HTMLInputElement | null | undefined =>
      Array.from(host.querySelectorAll('[aria-label="Keypad layout"] label'))
        .find((label) => label.textContent.trim() === name)
        ?.querySelector('input');
    expect(layout('Calculator')?.checked).toBe(true);

    layout('Telephone')?.click();

    expect(TestBed.inject(KeypadLayoutSetting).layout()).toBe('telephone');
  });

  function button(host: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(host.querySelectorAll('button')).find(
      (each) => each.getAttribute('aria-label') === label || each.textContent.trim() === label,
    );
  }

  it('brings back the default keypad layout, once it was changed', async () => {
    const setting = TestBed.inject(KeypadLayoutSetting);
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const revert = button(host, "Back to the game's keypad layout");
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

    button(host, "Back to the game's countdown")?.click();

    expect(tweaks.countdown()).toBe(true);
  });

  it('brings back every default value at once', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    const tweaks = TestBed.inject(Tweaks);
    const setting = TestBed.inject(KeypadLayoutSetting);
    const fixture = TestBed.createComponent(Settings);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(button(host, 'Reset All')?.disabled).toBe(true);

    await tweaks.setCountdown(false);
    await setting.set('telephone');
    await fixture.whenStable();
    button(host, 'Reset All')?.click();

    expect(tweaks.countdown()).toBe(true);
    expect(setting.layout()).toBe('calculator');
  });

  it('has no developer settings outside developer mode', async () => {
    const host = await setUp();

    expect(countdown(host)).toBeNull();
  });
});
