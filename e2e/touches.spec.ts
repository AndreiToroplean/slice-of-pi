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

test('records a touch slid off its key, from on its digit, as one typing nothing, where it lifted', async ({
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

  await touchAlong(touches, [await center('1')]);
  await touchAlong(touches, [await center('4'), await center('5')]);
  await touchAlong(touches, [await center('4')]);

  // Where each touch lifted, to a hundredth of a step, and what it typed.
  await expect
    .poll(async () =>
      (await recordedTouches(page)).map((touch) => {
        const { key, x, y } = touch as { key: string | null; x: number; y: number };
        return [key, Math.round(x * 100) / 100, Math.round(y * 100) / 100];
      }),
    )
    .toEqual([
      ['1', -1, 1],
      [null, 0, 0],
      ['4', -1, 0],
    ]);
});
