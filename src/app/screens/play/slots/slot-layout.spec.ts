import { slotLayout } from './slot-layout';

describe('slotLayout', () => {
  it("shows one slot per digit of the group's size, on one row", () => {
    expect(slotLayout(0, 5)).toEqual({ count: 5, columns: 5 });
    expect(slotLayout(3, 5)).toEqual({ count: 5, columns: 5 });
    expect(slotLayout(5, 5)).toEqual({ count: 5, columns: 5 });
  });

  it('adds one slot per digit typed past its size, as mistakes are', () => {
    expect(slotLayout(6, 5)).toEqual({ count: 6, columns: 6 });
    expect(slotLayout(8, 5).count).toBe(8);
  });

  it('grows a row up to 10 slots, then starts a new row', () => {
    expect(slotLayout(10, 5).columns).toBe(10);
    expect(slotLayout(11, 5)).toEqual({ count: 11, columns: 10 });
    expect(slotLayout(23, 5)).toEqual({ count: 23, columns: 10 });
  });

  it('shows a single slot for a group of 1', () => {
    expect(slotLayout(0, 1)).toEqual({ count: 1, columns: 1 });
  });
});
