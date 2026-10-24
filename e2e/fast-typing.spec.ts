import { expect, test } from '@playwright/test';
import { PI_DECIMALS } from '../src/app/game/pi/pi-decimals';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 384, height: 824 } });

test('types every digit tapped on the keypad, however fast', async ({ page }) => {
  await page.goto('/play');
  const keypad = page.getByRole('group', { name: 'Keypad' });
  await keypad.waitFor();
  // Where the keys are once the screen has come in.
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const centers = new Map<string, { x: number; y: number }>();
  for (const key of '0123456789') {
    const box = await keypad.locator(`[data-key="${key}"]`).boundingBox();
    if (box === null) {
      throw new Error(`No key ${key}`);
    }
    centers.set(key, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }

  const decimals = PI_DECIMALS.slice(0, 100);
  for (const digit of decimals) {
    const center = centers.get(digit);
    if (center !== undefined) {
      await page.touchscreen.tap(center.x, center.y);
    }
  }

  await expect(page.getByText(/digits typed, the last one is/)).toHaveText(
    `100 digits typed, the last one is ${decimals.slice(-1)}.`,
  );
  await expect(page.getByText(/is wrong/)).toHaveCount(0);
});
