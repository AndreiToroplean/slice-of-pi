import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 384, height: 824 } });

test('slides the slots of a group ending short of its slots together, centered, before they fly', async ({
  page,
}) => {
  await page.goto('/play');
  const area = page.locator('app-slots');
  await expect(area.locator('.slot')).toHaveCount(5);
  // Once the screen has come in, scaling everything on it meanwhile.
  await page.waitForFunction(() => document.getAnimations().length === 0);
  for (const digit of '141') {
    await page.keyboard.press(digit);
  }

  // Where each flying slot is once slid: its box, moved by its second keyframe's translation.
  await expect(page.locator('.flying-slot')).toHaveCount(3);
  const slid = await page.locator('.flying-slot').evaluateAll((copies) =>
    copies.map((copy) => {
      // Where it starts, on the play screen, rather than where its flight has taken it already.
      const layer = copy.parentElement?.getBoundingClientRect() ?? new DOMRect();
      const box = new DOMRect(
        layer.left + parseFloat(copy.style.left),
        layer.top + parseFloat(copy.style.top),
        parseFloat(copy.style.width),
        parseFloat(copy.style.height),
      );
      const effect = copy.getAnimations()[0]?.effect;
      const keyframes = effect instanceof KeyframeEffect ? effect.getKeyframes() : [];
      const [, x = '0'] = /translate\((-?[\d.]+)px/.exec(String(keyframes[1]?.transform)) ?? [];
      return { center: box.left + box.width / 2 + Number(x), width: box.width };
    }),
  );
  const box = await area.boundingBox();
  if (box === null) {
    throw new Error('No slots');
  }

  const middle = slid[1]?.center ?? 0;
  expect(middle).toBeCloseTo(box.x + box.width / 2, 0);
  expect((slid[2]?.center ?? 0) - middle).toBeCloseTo(middle - (slid[0]?.center ?? 0), 0);
  await expect(page.locator('app-typed-digits .word')).toHaveCount(1);
});
