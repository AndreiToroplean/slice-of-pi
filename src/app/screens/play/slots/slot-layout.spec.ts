import { slotBoxes, slotLayout } from './slot-layout';

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

describe('slotBoxes', () => {
  const area = { left: 0, top: 100, width: 300, height: 80 };
  const slot = { width: 20, height: 30 };
  const gap = { column: 5, row: 10 };

  it('centers a row across the area, on its bottom', () => {
    expect(slotBoxes(3, area, slot, gap)).toEqual([
      { left: 115, top: 150, width: 20, height: 30 },
      { left: 140, top: 150, width: 20, height: 30 },
      { left: 165, top: 150, width: 20, height: 30 },
    ]);
  });

  it('starts a new row past 10 slots, the rows standing on the bottom together', () => {
    const boxes = slotBoxes(12, area, slot, gap);

    expect(boxes[0]).toMatchObject({ left: 27.5, top: 110 });
    expect(boxes[10]).toMatchObject({ left: 27.5, top: 150 });
    expect(boxes[11]).toMatchObject({ left: 52.5, top: 150 });
  });
});
