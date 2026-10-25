import { expect, test } from '@playwright/test';

test('stops showing a key pressed once the mouse is dragged too far off it to type it', async ({
  page,
}) => {
  await page.goto('/play');
  const keypad = page.getByRole('group', { name: 'Keypad' });
  await keypad.waitFor();
  // Where the keys are once the screen has come in.
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const four = keypad.locator('[data-key="4"]');
  const six = keypad.locator('[data-key="6"]');
  const center = async (key: typeof four): Promise<{ x: number; y: number }> => {
    const box = await key.boundingBox();
    if (box === null) {
      throw new Error('No key');
    }
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  // Whether a key shows pressed: sunk into its edge.
  const sunk = (key: typeof four): Promise<boolean> =>
    key.evaluate((element) => getComputedStyle(element).translate !== 'none');

  const start = await center(four);
  const end = await center(six);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect.poll(() => sunk(four)).toBe(true);
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await expect.poll(() => sunk(four)).toBe(false);
  await page.mouse.up();
});
