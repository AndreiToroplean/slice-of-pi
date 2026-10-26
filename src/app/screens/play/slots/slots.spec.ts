import { TestBed } from '@angular/core/testing';
import { placeColors } from '../../../game/layers/place-colors';
import { installAnimations, uninstallAnimations } from '../../../../testing/fake-animations';
import { HANDOVER_DURATION, SlotHandover, Slots } from './slots';

describe('Slots', () => {
  async function render(digits: string, size = 5, wrong = 0): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Slots);
    fixture.componentRef.setInput('digits', digits);
    fixture.componentRef.setInput('colors', placeColors(digits));
    fixture.componentRef.setInput('size', size);
    fixture.componentRef.setInput('wrong', wrong);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function slots(host: HTMLElement): HTMLElement[] {
    return Array.from(host.querySelectorAll<HTMLElement>('.slot'));
  }

  it("shows as many empty slots as the group's size, the first one next", async () => {
    const host = await render('');

    expect(slots(host).map((slot) => slot.className)).toEqual([
      'slot next',
      'slot',
      'slot',
      'slot',
      'slot',
    ]);
    expect(slots(host).every((slot) => slot.textContent === '')).toBe(true);
  });

  it('marks the last digits typed as mistakes, as many as there are', async () => {
    const host = await render('1407', 5, 2);

    expect(slots(host).map((slot) => slot.classList.contains('wrong'))).toEqual([
      false,
      false,
      true,
      true,
      false,
    ]);
    expect((await render('141')).querySelector('.wrong')).toBeNull();
  });

  it('fills the slots with the digits typed, the following one next', async () => {
    const host = await render('141');

    expect(slots(host).map((slot) => slot.textContent)).toEqual(['1', '4', '1', '', '']);
    expect(slots(host).map((slot) => slot.className)).toEqual([
      'slot filled',
      'slot filled',
      'slot filled',
      'slot next',
      'slot',
    ]);
  });

  it('shows each filled slot in its color, and the empty ones in none', async () => {
    const host = await render('141');

    expect(slots(host).map((slot) => slot.style.getPropertyValue('--place-color'))).toEqual([
      ...placeColors('141'),
      '',
      '',
    ]);
  });

  it('adds a filled slot per digit typed past its size, with no next slot', async () => {
    const host = await render('1415926');

    expect(slots(host).map((slot) => slot.textContent)).toEqual('1415926'.split(''));
    expect(host.querySelector('.next')).toBeNull();
  });

  it('lays out one row up to 10 slots, then wraps onto new rows', async () => {
    expect((await render('')).style.getPropertyValue('--columns')).toBe('5');
    expect((await render('14159265')).style.getPropertyValue('--columns')).toBe('8');

    const host = await render('141592653589');

    expect(slots(host)).toHaveLength(12);
    expect(host.style.getPropertyValue('--columns')).toBe('10');
  });

  it("follows the group's size", async () => {
    expect(slots(await render('', 3))).toHaveLength(3);
  });

  it('shows no text besides the digits, and is hidden from assistive technology', async () => {
    const host = await render('14');

    expect(host.textContent.replace(/\s/g, '')).toBe('14');
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  describe('handing over', () => {
    afterEach(() => {
      uninstallAnimations();
      vi.unstubAllGlobals();
    });

    async function handOver(size: number, handover: SlotHandover) {
      const fixture = TestBed.createComponent(Slots);
      fixture.componentRef.setInput('digits', '');
      fixture.componentRef.setInput('colors', []);
      fixture.componentRef.setInput('size', size);
      fixture.componentRef.setInput('handover', handover);
      await fixture.whenStable();
      return { fixture, host: fixture.nativeElement as HTMLElement };
    }

    const handover: SlotHandover = { from: 5, leftAt: (index) => 100 * index };

    it('moves each slot once the digit of the slot it was has left, those going fading out', async () => {
      const animations = installAnimations();

      const { host } = await handOver(3, handover);

      expect(host.querySelectorAll('.slot.leaving')).toHaveLength(2);
      expect(animations).toHaveLength(5);
      const [first, , third, goingFirst] = animations;
      // The first of the 3 slots was the third of the 5, whose digit leaves at 200 ms.
      expect(first?.keyframes[1]?.offset).toBe(200 / (200 + HANDOVER_DURATION));
      expect(third?.keyframes[1]?.offset).toBe(400 / (400 + HANDOVER_DURATION));
      expect(first?.keyframes.some((keyframe) => 'opacity' in keyframe)).toBe(false);
      expect(goingFirst?.keyframes.map((keyframe) => keyframe['opacity'])).toEqual([1, 1, 0]);
      expect(goingFirst?.options?.fill).toBe('forwards');
    });

    it('fades in the slots coming past those of the group that ended', async () => {
      const animations = installAnimations();

      await handOver(5, { from: 3, leftAt: (index) => 100 * index });

      expect(animations.map((animation) => animation.keyframes[0]?.['opacity'])).toEqual([
        undefined,
        undefined,
        undefined,
        0,
        0,
      ]);
    });

    it('drops the slots going once they have gone', async () => {
      const animations = installAnimations();
      const { fixture, host } = await handOver(3, handover);

      for (const animation of animations) {
        animation.finish();
      }
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();

      expect(host.querySelectorAll('.slot.leaving')).toHaveLength(0);
    });

    it("doesn't move when the player prefers reduced motion, nor past a row", async () => {
      const animations = installAnimations();
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      await handOver(3, handover);
      vi.unstubAllGlobals();
      await handOver(12, handover);

      expect(animations).toEqual([]);
    });
  });
});
