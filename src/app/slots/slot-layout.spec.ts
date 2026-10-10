import { slotLayout } from './slot-layout';

describe('slotLayout', () => {
  it('shows the hint as large slots on one row', () => {
    expect(slotLayout(0, 5)).toEqual({ count: 5, columns: 5, dense: false });
    expect(slotLayout(3, 5)).toEqual({ count: 5, columns: 5, dense: false });
    expect(slotLayout(5, 5)).toEqual({ count: 5, columns: 5, dense: false });
  });

  it('adds one slot per digit typed past the hint', () => {
    expect(slotLayout(6, 5)).toEqual({ count: 6, columns: 6, dense: false });
    expect(slotLayout(8, 5).count).toBe(8);
  });

  it('switches to smaller slots past 6', () => {
    expect(slotLayout(6, 5).dense).toBe(false);
    expect(slotLayout(7, 5).dense).toBe(true);
    expect(slotLayout(0, 7).dense).toBe(true);
  });

  it('grows a row up to 10 slots, then starts a new row', () => {
    expect(slotLayout(10, 5).columns).toBe(10);
    expect(slotLayout(11, 5)).toEqual({ count: 11, columns: 10, dense: true });
    expect(slotLayout(23, 5)).toEqual({ count: 23, columns: 10, dense: true });
  });

  it('shows a single slot for a hint of 1', () => {
    expect(slotLayout(0, 1)).toEqual({ count: 1, columns: 1, dense: false });
  });
});
