import { DISCOVERY_SPEED, paceInterval } from './discovery-pace';

describe('Discovery pace', () => {
  it('plays the medium pace at its speed, the others a step slower or faster', () => {
    expect(paceInterval('medium')).toBeCloseTo(1000 / DISCOVERY_SPEED);
    expect(paceInterval('medium', 2)).toBe(500);
    expect(paceInterval('slower', 2, 20)).toBe(1000 / 1.6);
    expect(paceInterval('faster', 2, 20)).toBe(1000 / 2.4);
  });
});
