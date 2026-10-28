import { rowStart, shownSlots, slotBoxes, slotGap, slotHandover } from './slot-layout';

describe('shownSlots', () => {
  it("shows one slot per digit of the group's size", () => {
    expect(shownSlots(0, 5)).toBe(5);
    expect(shownSlots(3, 5)).toBe(5);
    expect(shownSlots(0, 1)).toBe(1);
  });

  it('adds one slot per digit typed past its size, as mistakes are', () => {
    expect(shownSlots(6, 5)).toBe(6);
    expect(shownSlots(23, 5)).toBe(23);
  });

  it('shows at most 10 slots for a larger group, then one per digit typed past them', () => {
    expect(shownSlots(0, 12)).toBe(10);
    expect(shownSlots(10, 12)).toBe(10);
    expect(shownSlots(11, 12)).toBe(11);
  });
});

describe('rowStart', () => {
  it('centers up to 10 slots, and ends past them where 10 do', () => {
    expect(rowStart(10)).toBe(0);
    expect(rowStart(5)).toBe(2.5);
    expect(rowStart(12)).toBe(-2);
  });
});

describe('slotGap', () => {
  it('spaces the slots for 10 of them to span the row', () => {
    expect(slotGap(245, 20)).toBe(5);
  });

  it('puts no gap between slots too wide for 10 of them to fit', () => {
    expect(slotGap(180, 20)).toBe(0);
  });
});

describe('slotBoxes', () => {
  // 10 slots 20 wide span the area 5 apart.
  const area = { left: 0, top: 100, width: 245, height: 80 };
  const slot = { width: 20, height: 30 };

  it('centers a row across the area, on its bottom', () => {
    expect(slotBoxes(3, area, slot)).toEqual([
      { left: 87.5, top: 150, width: 20, height: 30 },
      { left: 112.5, top: 150, width: 20, height: 30 },
      { left: 137.5, top: 150, width: 20, height: 30 },
    ]);
  });

  it('ends a row too long for the area where the area does, its first slots off it, to the left', () => {
    const boxes = slotBoxes(14, area, slot);

    expect(boxes[0]).toMatchObject({ left: -100, top: 150 });
    expect(boxes[13]).toMatchObject({ left: 225, top: 150 });
  });
});

describe('slotHandover', () => {
  it('moves the slots left by half a step, from 3 to 4, the fourth imagined past the three and fading in', () => {
    expect(slotHandover(3, 4)).toEqual({
      slots: [
        { from: 0.5, to: 0, after: 0 },
        { from: 1.5, to: 1, after: 1 },
        { from: 2.5, to: 2, after: 2 },
        { from: 3.5, to: 3, after: 3, fade: 'in' },
      ],
      leaving: [],
    });
  });

  it('moves the slots left by a step, from 5 to 3: the three rightmost stay, the two leftmost go off-center, fading out', () => {
    expect(slotHandover(5, 3)).toEqual({
      slots: [
        { from: 1, to: 0, after: 2 },
        { from: 2, to: 1, after: 3 },
        { from: 3, to: 2, after: 4 },
      ],
      leaving: [
        { from: -1, to: -2, after: 0, fade: 'out' },
        { from: 0, to: -1, after: 1, fade: 'out' },
      ],
    });
  });

  it('moves the slots from 12 as from the 10 shown, the 2 off the slots fading out too', () => {
    const { slots, leaving } = slotHandover(12, 5);

    expect(slots[0]).toEqual({ from: 2.5, to: 0, after: 7 });
    expect(leaving).toHaveLength(7);
    expect(leaving[0]).toEqual({ from: -4.5, to: -7, after: 0, fade: 'out' });
    expect(leaving[2]).toEqual({ from: -2.5, to: -5, after: 2, fade: 'out' });
  });

  it('makes room for an eleventh slot by moving the 10 left a whole step', () => {
    expect(slotHandover(10, 11).slots.map(({ from, to }) => from - to)).toEqual(
      Array.from({ length: 11 }, () => 1),
    );
  });

  it("doesn't move the slots when there are as many", () => {
    expect(slotHandover(4, 4).slots.every((move) => move.from === move.to)).toBe(true);
  });
});
