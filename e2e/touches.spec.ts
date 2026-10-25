import { CDPSession, expect, Page, test } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 384, height: 824 } });

interface Point {
  readonly x: number;
  readonly y: number;
}

/** The touches recorded in the touch log of the latest run. */
async function recordedTouches(page: Page): Promise<unknown[]> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('slice-of-pi');
      request.onsuccess = () => {
        resolve(request.result);
      };
    });
    const logs = await new Promise<{ startedAt: number; touches: unknown[] }[]>((resolve) => {
      const request = database.transaction('runs').objectStore('runs').getAll();
      request.onsuccess = () => {
        resolve(request.result as { startedAt: number; touches: unknown[] }[]);
      };
    });
    return logs.sort((a, b) => b.startedAt - a.startedAt)[0]?.touches ?? [];
  });
}

/** Touches the screen along a path, as one finger: down at its start, moving along it, and up at its end. */
async function touchAlong(touches: CDPSession, path: readonly Point[]): Promise<void> {
  const [start, ...rest] = path;
  if (start === undefined) {
    return;
  }
  await touches.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (const point of rest) {
    await touches.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
  }
  await touches.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('records a touch slid too far off its key, and one elsewhere, as typing nothing, where they lifted', async ({
  page,
}) => {
  await page.goto('/play');
  const keypad = page.getByRole('group', { name: 'Keypad' });
  await keypad.waitFor();
  // Where the keys are once the screen has come in.
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const center = async (key: string): Promise<Point> => {
    const box = await keypad.locator(`[data-key="${key}"]`).boundingBox();
    if (box === null) {
      throw new Error(`No key ${key}`);
    }
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const touches = await page.context().newCDPSession(page);

  const slots = await page.locator('app-slots').boundingBox();
  if (slots === null) {
    throw new Error('No slots');
  }

  await touchAlong(touches, [await center('1')]);
  await touchAlong(touches, [await center('4'), await center('6')]);
  // Over the slots, the column of 5, half a step above where the keypad starts.
  await touchAlong(touches, [{ x: (await center('5')).x, y: slots.y + slots.height / 2 }]);
  await touchAlong(touches, [await center('4')]);

  // Where each touch lifted, to a hundredth of a step (-0 as 0), and what it typed.
  await expect
    .poll(async () =>
      (await recordedTouches(page)).map((touch) => {
        const { key, x, y } = touch as { key: string | null; x: number; y: number };
        return [key, Math.round(x * 100) / 100 + 0, Math.round(y * 100) / 100 + 0];
      }),
    )
    .toEqual([
      ['1', -1, 1],
      [null, 1, 0],
      [null, 0, expect.any(Number) as number],
      ['4', -1, 0],
    ]);
  const [, , elsewhere] = await recordedTouches(page);
  expect((elsewhere as { y: number }).y).toBeLessThan(-1.5);
});
