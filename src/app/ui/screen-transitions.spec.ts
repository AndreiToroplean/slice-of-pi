import { TestBed } from '@angular/core/testing';
import { ScreenTransitions } from './screen-transitions';

describe('ScreenTransitions', () => {
  it('is settled until a transition starts, and again once every one has finished, or failed', async () => {
    const transitions = TestBed.inject(ScreenTransitions);
    expect(transitions.settled()).toBe(true);
    let finish = (): void => undefined;
    let fail = (): void => undefined;
    const finished = new Promise<void>((resolve) => (finish = resolve));
    const failed = new Promise<void>(
      (_, reject) =>
        (fail = () => {
          reject(new Error('skipped'));
        }),
    );

    transitions.began(finished);
    transitions.began(failed);
    expect(transitions.settled()).toBe(false);

    finish();
    await finished;
    await Promise.resolve();
    expect(transitions.settled()).toBe(false);

    fail();
    await vi.waitFor(() => {
      expect(transitions.settled()).toBe(true);
    });
  });
});
