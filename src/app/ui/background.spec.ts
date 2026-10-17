import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { hueOf, mixGradients, shortWay } from '../game/color/color-spaces';
import { SEASON_COLOR_SPACE, seasonAt } from '../game/layers/seasons';
import { Background, BACKGROUND_EASE } from './background';

describe('Background', () => {
  it("starts on a new game's colors", () => {
    expect(TestBed.inject(Background).colors()).toEqual(seasonAt(0).background);
    expect(TestBed.inject(Background).shown()).toEqual(seasonAt(0).background);
  });

  it("blends the browser's bars into the top of the background", async () => {
    const background = TestBed.inject(Background);

    background.colors.set(seasonAt(42).background);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(TestBed.inject(Meta).getTag('name="theme-color"')?.content).toBe(
      seasonAt(42).background[0],
    );
  });

  describe('easing', () => {
    let time: number;
    let frames: FrameRequestCallback[];

    beforeEach(() => {
      time = 0;
      frames = [];
      vi.spyOn(performance, 'now').mockImplementation(() => time);
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        frames.push(callback),
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    /** Runs the frames due `after` milliseconds from now. */
    function advance(after: number): void {
      time += after;
      const due = frames;
      frames = [];
      for (const frame of due) {
        frame(time);
      }
    }

    it('eases to new colors, getting there once the ease is over', async () => {
      const background = TestBed.inject(Background);
      const start = background.shown();
      background.colors.set(seasonAt(60).background);
      await TestBed.inject(ApplicationRef).whenStable();

      advance(BACKGROUND_EASE / 2);
      const halfway = background.shown();
      expect(halfway).not.toEqual(start);
      expect(halfway).not.toEqual(seasonAt(60).background);

      advance(BACKGROUND_EASE / 2);
      expect(background.shown()).toEqual(seasonAt(60).background);
      advance(BACKGROUND_EASE);
      expect(background.shown()).toEqual(seasonAt(60).background);
    });

    it('restarts from the colors shown when new colors come during an ease', async () => {
      const background = TestBed.inject(Background);
      background.colors.set(seasonAt(60).background);
      await TestBed.inject(ApplicationRef).whenStable();
      advance(BACKGROUND_EASE / 4);
      const shown = background.shown();

      background.colors.set(seasonAt(0).background);
      await TestBed.inject(ApplicationRef).whenStable();
      advance(BACKGROUND_EASE / 4);

      expect(background.shown()).toEqual(
        mixGradients(shown, seasonAt(0).background, 1 - (3 / 4) ** 3, SEASON_COLOR_SPACE),
      );
    });

    it('never flips the way the gradient turns, even between colors far apart', async () => {
      // Late winter to spring at once, as when leaving a game for the main menu.
      const background = TestBed.inject(Background);
      background.colors.set(seasonAt(95).background);
      await TestBed.inject(ApplicationRef).whenStable();
      advance(BACKGROUND_EASE);
      background.colors.set(seasonAt(0).background);
      await TestBed.inject(ApplicationRef).whenStable();

      const turns: number[] = [];
      for (let frame = 0; frame < 50; frame++) {
        advance(BACKGROUND_EASE / 50);
        const [top, bottom] = background.shown();
        turns.push(shortWay(hueOf(top, 'oklch'), hueOf(bottom, 'oklch')));
      }
      for (const [frame, turn] of turns.entries()) {
        expect(Math.abs(turn - (turns[frame + 1] ?? turn))).toBeLessThan(90);
      }
    });
  });
});
