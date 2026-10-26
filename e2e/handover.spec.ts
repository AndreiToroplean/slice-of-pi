import { expect, Page, test } from '@playwright/test';
import { PI_DECIMALS } from '../src/app/game/pi/pi-decimals';

test.use({ viewport: { width: 384, height: 824 } });

/**
 * Right as the slots of a group that ended start to fly: the centers across of the flying slots once slid, which they
 * lift off from, and of the next group's slots, those leaving included, where they wait to move from.
 */
async function handOver(
  page: Page,
  digits: string,
): Promise<{ flying: number[]; slots: number[] }> {
  for (const digit of digits) {
    await page.keyboard.press(digit);
  }
  await expect(page.locator('.flying-slot')).toHaveCount(digits.length);
  return page.evaluate(() => {
    const flying = Array.from(document.querySelectorAll<HTMLElement>('.flying-slot'), (copy) => {
      const layer = copy.parentElement?.getBoundingClientRect() ?? new DOMRect();
      const effect = copy.getAnimations()[0]?.effect;
      const keyframes = effect instanceof KeyframeEffect ? effect.getKeyframes() : [];
      const [, x = '0'] = /translate\((-?[\d.]+)px/.exec(String(keyframes[1]?.transform)) ?? [];
      return (
        layer.left + parseFloat(copy.style.left) + parseFloat(copy.style.width) / 2 + Number(x)
      );
    });
    // Leaving ones first: they were the leftmost.
    const slots = [
      ...document.querySelectorAll('app-slots .slot.leaving'),
      ...document.querySelectorAll('app-slots .slot:not(.leaving)'),
    ].map((slot) => {
      const box = slot.getBoundingClientRect();
      return box.left + box.width / 2;
    });
    return { flying, slots };
  });
}

test('moves the slots on from right under the digits flying off them, as many or more coming, or fewer', async ({
  page,
}) => {
  await page.goto('/play');
  await expect(page.locator('app-slots .slot')).toHaveCount(5);
  // Once the screen has come in, scaling everything on it meanwhile.
  await page.waitForFunction(() => document.getAnimations().length === 0);

  // 7 slots, typed on past 5, hand over to 5: the 2 leftmost go.
  const fewer = await handOver(page, PI_DECIMALS.slice(0, 7));
  expect(fewer.slots).toHaveLength(7);
  fewer.flying.forEach((center, i) => {
    expect(fewer.slots[i]).toBeCloseTo(center, 0);
  });
  await expect(page.locator('app-slots .slot.leaving')).toHaveCount(0);
  await page.waitForFunction(() => document.getAnimations().length === 0);

  // 3 of 5 slots filled hand over to 5: the 3 slid together, then 2 more past them.
  const more = await handOver(page, PI_DECIMALS.slice(7, 10));
  expect(more.slots).toHaveLength(5);
  const step = (more.flying[1] ?? 0) - (more.flying[0] ?? 0);
  more.slots.forEach((center, i) => {
    expect(center).toBeCloseTo((more.flying[0] ?? 0) + i * step, 0);
  });
});

test('makes room for more slots as the group grows, moving them on from where they were', async ({
  page,
}) => {
  await page.goto('/play');
  await expect(page.locator('app-slots .slot')).toHaveCount(5);
  await page.waitForFunction(() => document.getAnimations().length === 0);
  for (const digit of PI_DECIMALS.slice(0, 5)) {
    await page.keyboard.press(digit);
  }

  // The slots' centers across just before the sixth digit, and on the first frame after it.
  const { before, after, opacity } = await page.evaluate(async (digit) => {
    const centers = (): number[] =>
      Array.from(document.querySelectorAll('app-slots .slot'), (slot) => {
        const box = slot.getBoundingClientRect();
        return box.left + box.width / 2;
      });
    const before = centers();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: digit, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: digit, bubbles: true }));
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const sixth = document.querySelectorAll('app-slots .slot')[5];
    return {
      before,
      after: centers(),
      opacity: sixth === undefined ? 1 : Number(getComputedStyle(sixth).opacity),
    };
  }, PI_DECIMALS.charAt(5));

  expect(after).toHaveLength(6);
  const step = (before[1] ?? 0) - (before[0] ?? 0);
  after.forEach((center, i) => {
    // A frame or two into a move of half a step.
    expect(Math.abs(center - ((before[0] ?? 0) + i * step))).toBeLessThan(step / 8);
  });
  expect(opacity).toBeLessThan(0.5);
});

test('keeps the slots still on backspace as they grow, then slides the digits left together before they fly', async ({
  page,
}) => {
  await page.goto('/play');
  await expect(page.locator('app-slots .slot')).toHaveCount(5);
  await page.waitForFunction(() => document.getAnimations().length === 0);
  for (const digit of PI_DECIMALS.slice(0, 5)) {
    await page.keyboard.press(digit);
  }

  // Growing to 6 slots, then backspace on the next frame, while they move.
  const { before, after } = await page.evaluate(async (digit) => {
    const centers = (): number[] =>
      Array.from(document.querySelectorAll('app-slots .slot'), (slot) => {
        const box = slot.getBoundingClientRect();
        return box.left + box.width / 2;
      });
    const press = (key: string): void => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    };
    press(digit);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const before = centers();
    press('Backspace');
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return { before, after: centers() };
  }, PI_DECIMALS.charAt(5));

  expect(after).toHaveLength(6);
  const step = (before[1] ?? 0) - (before[0] ?? 0);
  after.forEach((center, i) => {
    expect(Math.abs(center - (before[i] ?? 0))).toBeLessThan(step / 8);
  });
  // The 5 digits fly from the middle of the slots, slid there together.
  await expect(page.locator('.flying-slot')).toHaveCount(5);
  const slides = await page.locator('.flying-slot').evaluateAll((copies) =>
    copies.map((copy) => {
      const effect = copy.getAnimations()[0]?.effect;
      const keyframes = effect instanceof KeyframeEffect ? effect.getKeyframes() : [];
      return String(keyframes[1]?.transform);
    }),
  );
  expect(slides.every((slide) => /^translate\([1-9][\d.]*px, 0px\)$/.test(slide))).toBe(true);
});
