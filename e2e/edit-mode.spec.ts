import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 384, height: 824 } });

test('drags a handle of edit mode with a finger, the keypad following it, and keeps the layout once done', async ({
  page,
}) => {
  await page.goto('/');
  // Developer mode, turned on by tapping the game's icon ten times in a row.
  await page.getByRole('button', { name: 'Slice of Pi' }).click({ clickCount: 10 });
  await expect(page.getByRole('button', { name: 'Developer Pages' })).toBeVisible();
  await page.goto('/play');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Edit Layout' }).click();
  const knob = page.getByRole('slider', { name: 'Keypad top' });
  await expect(knob).toHaveAttribute('aria-valuenow', '35');
  const keyTop = async (): Promise<number> =>
    (await page.getByRole('button', { name: '7', exact: true }).boundingBox())?.y ?? NaN;
  const box = await knob.boundingBox();
  if (box === null) {
    throw new Error('No knob');
  }
  const before = await keyTop();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const touches = await page.context().newCDPSession(page);

  await touches.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (const step of [10, 20, 30, 40]) {
    await touches.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - step }],
    });
  }
  await touches.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect.poll(keyTop).toBeCloseTo(before - 40, 0);
  const value = Number(await knob.getAttribute('aria-valuenow'));
  expect(value).toBeGreaterThan(39);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.reload();
  await expect.poll(keyTop).toBeCloseTo(before - 40, 0);
});
