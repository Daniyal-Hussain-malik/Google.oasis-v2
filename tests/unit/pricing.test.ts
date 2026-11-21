import { describe, expect, it } from 'vitest';
import { nightlyRate, quoteStay } from '../../backend/src/services/pricing.js';

describe('pricing service', () => {
  const roomType = {
    baseRate: 18000,
    weekendRate: 21000,
  };

  it('uses baseRate on weekdays (Mon–Fri) and weekendRate on Saturdays & Sundays', () => {
    // 2026-11-20 = Friday (5), 2026-11-21 = Saturday (6), 2026-11-22 = Sunday (0), 2026-11-23 = Monday (1)
    expect(nightlyRate(roomType, '2026-11-20')).toEqual({ weekend: false, rate: 18000 });
    expect(nightlyRate(roomType, '2026-11-21')).toEqual({ weekend: true, rate: 21000 });
    expect(nightlyRate(roomType, '2026-11-22')).toEqual({ weekend: true, rate: 21000 });
    expect(nightlyRate(roomType, '2026-11-23')).toEqual({ weekend: false, rate: 18000 });
  });

  it('falls back to baseRate on weekends when weekendRate is zero or unset', () => {
    const flatRoom = { baseRate: 15000, weekendRate: 0 };
    expect(nightlyRate(flatRoom, '2026-11-21')).toEqual({ weekend: true, rate: 15000 });
  });

  it('quotes multi-night, multi-room stays with per-night breakdown and accurate average', () => {
    // 3 nights: Fri (18k), Sat (21k), Sun (21k) x 2 rooms = 36k + 42k + 42k = 120,000
    const quote = quoteStay(roomType, '2026-11-20', '2026-11-23', 2);
    expect(quote.rooms).toBe(2);
    expect(quote.nights).toBe(3);
    expect(quote.total).toBe(120000);
    expect(quote.average).toBe(40000);
    expect(quote.breakdown).toEqual([
      { date: '2026-11-20', label: 'Weekday rate, breakfast included', rate: 36000 },
      { date: '2026-11-21', label: 'Weekend rate, breakfast included', rate: 42000 },
      { date: '2026-11-22', label: 'Weekend rate, breakfast included', rate: 42000 },
    ]);
  });

  it('returns zero totals cleanly for an empty/invalid zero-night span', () => {
    const quote = quoteStay(roomType, '2026-11-20', '2026-11-20', 1);
    expect(quote).toEqual({
      rooms: 1,
      nights: 0,
      total: 0,
      average: 0,
      breakdown: [],
    });
  });
});
