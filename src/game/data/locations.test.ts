import { describe, expect, it } from 'vitest';
import { LOCATION_BY_ID, LOCATION_LABELS, WORLD_LOCATIONS, locationLayoutIssues } from './locations';

describe('authoritative town locations', () => {
  it('has nine unique, visible, non-overlapping hitboxes', () => {
    expect(WORLD_LOCATIONS).toHaveLength(9);
    expect(locationLayoutIssues()).toEqual([]);
  });

  it('keeps Bank and Café as distinct IDs, labels and interaction targets', () => {
    expect(LOCATION_BY_ID.bank.id).toBe('bank');
    expect(LOCATION_BY_ID.cafe.id).toBe('cafe');
    expect(LOCATION_LABELS.bank).toBe('Bank');
    expect(LOCATION_LABELS.cafe).toBe('Café');
    expect(LOCATION_BY_ID.bank.interaction).not.toBe(LOCATION_BY_ID.cafe.interaction);
  });
});
