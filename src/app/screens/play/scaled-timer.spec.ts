import { TestBed } from '@angular/core/testing';
import { FakeTime } from '../../../testing/fake-time';
import { RUN_CLOCK } from '../../player-data/run-recorder';
import { ScaledTimer } from './scaled-timer';
import { TIMER } from './timer';

describe('ScaledTimer', () => {
  let time: FakeTime;
  let timer: ScaledTimer;
  let calls: string[];

  beforeEach(() => {
    time = new FakeTime();
    TestBed.configureTestingModule({ providers: time.providers });
    const clock = TestBed.inject(RUN_CLOCK);
    timer = new ScaledTimer(TestBed.inject(TIMER), () => clock.now());
    calls = [];
  });

  it('calls back after the delay, at the clock’s rate by default', () => {
    timer.after(1000, () => calls.push('a'));

    time.advance(999);
    expect(calls).toEqual([]);
    time.advance(1);
    expect(calls).toEqual(['a']);
  });

  it('calls back sooner at a faster rate', () => {
    timer.setRate(2);
    timer.after(1000, () => calls.push('a'));

    time.advance(500);
    expect(calls).toEqual(['a']);
  });

  it('goes on at the new rate for what’s left of a wait as the rate changes', () => {
    timer.after(1000, () => calls.push('a'));
    time.advance(400);

    timer.setRate(2);
    time.advance(299);
    expect(calls).toEqual([]);
    time.advance(1);
    expect(calls).toEqual(['a']);
  });

  it('slows back down for what’s left', () => {
    timer.setRate(2);
    timer.after(1000, () => calls.push('a'));
    time.advance(250);

    timer.setRate(1);
    time.advance(499);
    expect(calls).toEqual([]);
    time.advance(1);
    expect(calls).toEqual(['a']);
  });

  it('never calls back once cancelled, whatever the rate does', () => {
    const stop = timer.after(1000, () => calls.push('a'));
    stop();
    timer.setRate(2);

    time.advance(2000);
    expect(calls).toEqual([]);
  });

  it('waits for as long as the time stands still, then goes on with what was left', () => {
    timer.after(1000, () => calls.push('a'));
    time.advance(400);

    timer.setRate(0);
    time.advance(5000);
    expect(calls).toEqual([]);

    timer.setRate(1);
    time.advance(599);
    expect(calls).toEqual([]);
    time.advance(1);
    expect(calls).toEqual(['a']);
  });

  it('tells its time, as it runs at its rate', () => {
    time.advance(100);
    expect(timer.time()).toBe(100);

    timer.setRate(2);
    time.advance(100);
    expect(timer.time()).toBe(300);

    timer.setRate(0);
    time.advance(100);
    expect(timer.time()).toBe(300);
  });
});
