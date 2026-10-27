import { TestBed } from '@angular/core/testing';
import { placeColors } from '../../../game/layers/place-colors';
import { installAnimations, uninstallAnimations } from '../../../../testing/fake-animations';
import { GROW_DURATION, HANDOVER_DURATION, SlotHandover, Slots } from './slots';

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

  it('lays out one row, overflowing past 10 slots', async () => {
    expect((await render('')).style.getPropertyValue('--columns')).toBe('5');
    expect((await render('')).classList).not.toContain('overflowing');

    const host = await render('141592653589');

    expect(slots(host)).toHaveLength(12);
    expect(host.style.getPropertyValue('--columns')).toBe('12');
    expect(host.classList).toContain('overflowing');
  });

  it("follows the group's size, up to 10 slots", async () => {
    expect(slots(await render('', 3))).toHaveLength(3);
    expect(slots(await render('14', 12))).toHaveLength(10);
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
      expect(first?.keyframes.some((keyframe) => '--appear' in keyframe)).toBe(false);
      expect(goingFirst?.keyframes.map((keyframe) => keyframe['--appear'])).toEqual([1, 1, 0]);
      expect(goingFirst?.options?.fill).toBe('forwards');
    });

    it('fades in the slots coming past those of the group that ended', async () => {
      const animations = installAnimations();

      await handOver(5, { from: 3, leftAt: (index) => 100 * index });

      expect(animations.map((animation) => animation.keyframes[0]?.['--appear'])).toEqual([
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

    it('makes room for more slots as the group grows, at once, each move adding to any under way, the new ones fading in', async () => {
      const animations = installAnimations();
      const fixture = TestBed.createComponent(Slots);
      fixture.componentRef.setInput('digits', '1415');
      fixture.componentRef.setInput('colors', placeColors('1415'));
      fixture.componentRef.setInput('size', 5);
      await fixture.whenStable();
      expect(animations).toEqual([]);

      fixture.componentRef.setInput('digits', '141592');
      fixture.componentRef.setInput('colors', placeColors('141592'));
      await fixture.whenStable();

      const moves = animations.filter((animation) => animation.options?.composite === 'add');
      expect(moves).toHaveLength(6);
      expect(moves.every((move) => move.options?.duration === GROW_DURATION)).toBe(true);
      expect(moves[0]?.keyframes.map((keyframe) => keyframe['translate'])).toEqual([
        '0px 0px',
        '0px 0px',
      ]);
      const fades = animations.filter((animation) => animation.options?.composite !== 'add');
      expect(fades.map((fade) => fade.element)).toEqual([
        (fixture.nativeElement as HTMLElement).querySelectorAll('.slot')[5],
      ]);
    });

    it('takes the last slots away as they came, in reverse, each move adding to any under way, dropping them once gone', async () => {
      const animations = installAnimations();
      const fixture = TestBed.createComponent(Slots);
      const host = fixture.nativeElement as HTMLElement;
      const show = async (digits: string): Promise<void> => {
        fixture.componentRef.setInput('digits', digits);
        fixture.componentRef.setInput('colors', placeColors(digits));
        await fixture.whenStable();
      };
      fixture.componentRef.setInput('size', 5);
      fixture.componentRef.setInput('wrong', 1);
      await show('141509');
      animations.splice(0);

      await show('14150');

      expect(host.querySelectorAll('.slot:not(.dropped)')).toHaveLength(5);
      expect(host.querySelectorAll('.slot.dropped')).toHaveLength(1);
      const moves = animations.filter((animation) => animation.options?.composite === 'add');
      expect(moves).toHaveLength(5);
      const going = animations.find((animation) => animation.element.classList.contains('dropped'));
      expect(going?.keyframes.map((keyframe) => keyframe['--appear'])).toEqual([1, 0]);

      going?.finish();
      await fixture.whenStable();
      expect(host.querySelectorAll('.slot.dropped')).toHaveLength(0);
    });

    it('hands over from more slots than shown, those off the slots going too', async () => {
      const animations = installAnimations();

      const { host } = await handOver(5, { from: 12, leftAt: (index) => 100 * index });

      expect(host.querySelectorAll('.slot.leaving')).toHaveLength(7);
      expect(animations).toHaveLength(12);
    });

    it("doesn't move when the player prefers reduced motion", async () => {
      const animations = installAnimations();
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      await handOver(3, handover);

      expect(animations).toEqual([]);
    });
  });
});
