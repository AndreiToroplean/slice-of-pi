import { expect, test } from '@playwright/test';
import { PI_DECIMALS } from '../src/app/game/pi/pi-decimals';
import { type } from './typing';

test.use({ viewport: { width: 384, height: 824 } });

test('scrolls the tape left as words come on, and glides it back, never jumping, as words come off', async ({
  page,
}) => {
  await page.goto('/play');
  const tape = page.getByRole('region', { name: 'Typed digits' });
  const words = tape.locator('.word');
  for (let word = 1; word <= 8; word++) {
    await type(page, PI_DECIMALS.slice((word - 1) * 5, word * 5));
    // The group ends as the player pauses.
    await expect(words).toHaveCount(word);
  }
  const scrolled = (): Promise<number> => tape.evaluate((element) => element.scrollLeft);
  const end = await tape.evaluate((element) => element.scrollWidth - element.clientWidth);
  await expect.poll(scrolled).toBeCloseTo(end, 0);
  await expect(tape).toHaveClass(/hidden-left/);

  // Where the tape is at each frame from now on.
  await tape.evaluate((element) => {
    const positions: number[] = [];
    Object.assign(window, { positions });
    const sample = (): void => {
      positions.push(element.scrollLeft);
      requestAnimationFrame(sample);
    };
    sample();
  });
  // The first word taken off leaves its room, and the tape stays; the next one scrolls it back by that room.
  await page.keyboard.press('Backspace');
  await expect(words.last()).toHaveText(/^\s*(\d\s*){4}$/);
  await expect.poll(scrolled).toBeCloseTo(end, 0);
  for (let press = 0; press < 5; press++) {
    await page.keyboard.press('Backspace');
  }
  // Long enough to glide back, though the word reopened may fly back on once its wait runs out.
  await page.waitForTimeout(600);

  const positions = await page.evaluate(
    () => (window as unknown as { positions: number[] }).positions,
  );
  const steps = positions.slice(1).map((position, i) => Math.abs(position - (positions[i] ?? 0)));
  expect(Math.min(...positions)).toBeLessThan(end - 20);
  expect(Math.max(...steps)).toBeLessThan(20);
});
