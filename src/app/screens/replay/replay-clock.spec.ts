import { ReplayClock } from './replay-clock';

describe('ReplayClock', () => {
  it('only moves when told to', () => {
    const clock = new ReplayClock();
    expect(clock.now()).toBe(0);

    clock.advanceTo(250);

    expect(clock.now()).toBe(250);
  });

  it('calls back what waits as the clock passes its time, in order, at its own time', () => {
    const clock = new ReplayClock();
    const calls: [string, number][] = [];
    clock.after(300, () => calls.push(['late', clock.now()]));
    clock.after(100, () => calls.push(['early', clock.now()]));

    clock.advanceTo(99);
    expect(calls).toEqual([]);
    clock.advanceTo(500);

    expect(calls).toEqual([
      ['early', 100],
      ['late', 300],
    ]);
    expect(clock.now()).toBe(500);
  });

  it('calls back what was set to wait by a call back, if its time comes', () => {
    const clock = new ReplayClock();
    const calls: number[] = [];
    clock.after(100, () => clock.after(50, () => calls.push(clock.now())));

    clock.advanceTo(200);

    expect(calls).toEqual([150]);
  });

  it('never calls back what was cancelled, nor what waits forever', () => {
    const clock = new ReplayClock();
    const callback = vi.fn();
    clock.after(100, callback)();
    clock.after(Infinity, callback);

    clock.advanceTo(1_000_000);

    expect(callback).not.toHaveBeenCalled();
  });

  it('repeats what repeats, until stopped', () => {
    const clock = new ReplayClock();
    const calls: number[] = [];
    const stop = clock.every(100, () => calls.push(clock.now()));

    clock.advanceTo(350);
    stop();
    clock.advanceTo(1000);

    expect(calls).toEqual([100, 200, 300]);
  });

  it('goes back to the start, forgetting what waits once, and carrying on what repeats', () => {
    const clock = new ReplayClock();
    const once = vi.fn();
    const repeated: number[] = [];
    clock.after(500, once);
    clock.every(100, () => repeated.push(clock.now()));
    clock.advanceTo(250);

    clock.reset();
    clock.advanceTo(1000);

    expect(clock.now()).toBe(1000);
    expect(once).not.toHaveBeenCalled();
    expect(repeated).toHaveLength(12);
  });
});
