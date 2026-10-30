import { describe, it, expect } from 'vitest';
import { fmtTime } from '../lib/utils';

describe('Timer and Time Formatting', () => {
  it('formats zero seconds as 00:00', () => {
    expect(fmtTime(0)).toBe('00:00');
  });

  it('formats under a minute correctly with leading zeros', () => {
    expect(fmtTime(9)).toBe('00:09');
    expect(fmtTime(45)).toBe('00:45');
  });

  it('formats multi-minute intervals correctly', () => {
    expect(fmtTime(60)).toBe('01:00');
    expect(fmtTime(125)).toBe('02:05');
    expect(fmtTime(1200)).toBe('20:00'); // 20 minutes
    expect(fmtTime(3600)).toBe('60:00'); // 60 minutes
  });

  it('handles negative or decimal values safely', () => {
    expect(fmtTime(-10)).toBe('00:00');
    expect(fmtTime(15.7)).toBe('00:15');
  });
});

