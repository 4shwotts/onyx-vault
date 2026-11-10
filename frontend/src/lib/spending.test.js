import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { summariseMonth, buildInsight, spendByCategory, transactionsInMonth } from './spending';

// The live API sends DATE columns as UTC-midnight timestamps
// ("2026-10-31T00:00:00.000Z"); a corrected API would send "2026-10-31".
// The maths has to be right for whatever the API sends.
const asApiTimestamp = (date) => `${date}T00:00:00.000Z`;

function tx(date, amount, category_name = 'Groceries') {
  return { date, amount, category_name };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));
  process.env.TZ = 'UTC';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('spendByCategory', () => {
  it('totals spending per category in pence and ignores income', () => {
    expect(spendByCategory([
      tx('2026-10-01', '-12.50'),
      tx('2026-10-02', '-0.10'),
      tx('2026-10-03', '-0.20', 'Transport'),
      tx('2026-10-04', '2100.00', 'Income'),
    ])).toEqual({ Groceries: 1260, Transport: 20 });
  });

  it('groups uncategorised spending as Other', () => {
    expect(spendByCategory([{ date: '2026-10-01', amount: '-5.00', category_name: null }])).toEqual({ Other: 500 });
  });

  it('is empty for no transactions', () => {
    expect(spendByCategory([])).toEqual({});
  });
});

describe('transactionsInMonth', () => {
  it.each([
    ['plain dates', (d) => d],
    ['API timestamps', asApiTimestamp],
  ])('includes the first and last day of the month (%s)', (_label, shape) => {
    const list = [
      tx(shape('2026-09-30'), '-1.00'),
      tx(shape('2026-10-01'), '-2.00'),
      tx(shape('2026-10-15'), '-3.00'),
      tx(shape('2026-10-31'), '-4.00'),
      tx(shape('2026-11-01'), '-5.00'),
    ];
    expect(transactionsInMonth(list, '2026-10').map((t) => t.amount)).toEqual(['-2.00', '-3.00', '-4.00']);
  });

  it('includes the last day of the month for a visitor in British Summer Time', () => {
    process.env.TZ = 'Europe/London';
    const list = [tx('2026-06-30', '-1.00'), tx('2026-07-01', '-2.00'), tx('2026-07-31', '-3.00'), tx('2026-08-01', '-4.00')];
    expect(transactionsInMonth(list, '2026-07').map((t) => t.amount)).toEqual(['-2.00', '-3.00']);
  });
});

describe('summariseMonth', () => {
  it('totals each category for the chosen month and the month before', () => {
    const list = [
      tx('2026-10-05', '-40.00'),
      tx('2026-10-20', '-60.00'),
      tx('2026-10-21', '-15.00', 'Transport'),
      tx('2026-09-10', '-80.00'),
      tx('2026-09-11', '-30.00', 'Transport'),
      tx('2026-10-28', '2100.00', 'Income'),
    ];
    const summary = summariseMonth(list, '2026-10');

    expect(summary.categories).toEqual([
      { name: 'Groceries', pence: 10000, prevPence: 8000, pct: 25 },
      { name: 'Transport', pence: 1500, prevPence: 3000, pct: -50 },
    ]);
    expect(summary.totalPence).toBe(11500);
    expect(summary.prevTotalPence).toBe(11000);
    expect(summary.isCurrentMonth).toBe(false);
    expect(summary.projectedPence).toBe(11500); // a finished month projects to its own total
  });

  it('counts spending on the last day of the month (API timestamps)', () => {
    const summary = summariseMonth([tx(asApiTimestamp('2026-10-31'), '-25.00')], '2026-10');
    expect(summary.totalPence).toBe(2500);
  });

  it('is empty for a month with no spending', () => {
    const summary = summariseMonth([tx('2026-10-28', '2100.00', 'Income')], '2026-10');
    expect(summary.categories).toEqual([]);
    expect(summary.totalPence).toBe(0);
    expect(buildInsight(summary)).toBeNull();
  });

  it('handles a single category with nothing to compare against', () => {
    const summary = summariseMonth([tx('2026-10-03', '-9.99', 'Subscriptions')], '2026-10');
    expect(summary.categories).toEqual([{ name: 'Subscriptions', pence: 999, prevPence: 0, pct: null }]);
  });

  it('compares across the year boundary (January against December)', () => {
    const summary = summariseMonth([tx('2026-01-10', '-20.00'), tx('2025-12-10', '-10.00')], '2026-01');
    expect(summary.categories[0]).toMatchObject({ pence: 2000, prevPence: 1000, pct: 100 });
  });

  it('projects the current month from the pace so far', () => {
    // 20 November: £200 spent in 20 days -> £300 over 30 days.
    const summary = summariseMonth([tx('2026-11-05', '-200.00')], '2026-11');
    expect(summary).toMatchObject({ isCurrentMonth: true, daysElapsed: 20, daysInMonth: 30, projectedPence: 30000 });
  });

  it('adds up awkward amounts exactly', () => {
    const list = ['-0.10', '-0.20', '-0.30'].map((a) => tx('2026-10-01', a));
    expect(summariseMonth(list, '2026-10').totalPence).toBe(60);
  });
});

describe('buildInsight', () => {
  // Same daily pace as last month: £10 a day on groceries every day of
  // October, and £10 a day so far in November.
  function steadyPace(today) {
    const list = [];
    for (let d = 1; d <= 31; d += 1) list.push(tx(`2026-10-${String(d).padStart(2, '0')}`, '-10.00'));
    for (let d = 1; d <= today; d += 1) list.push(tx(`2026-11-${String(d).padStart(2, '0')}`, '-10.00'));
    return list;
  }

  it('does not report a fall in spending early in the month when the pace is unchanged', () => {
    vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
    const insight = buildInsight(summariseMonth(steadyPace(3), '2026-11'));
    expect(insight.text).not.toMatch(/down|less|lower|fell/i);
  });

  it('does not describe a past month as "so far this month"', () => {
    const list = [tx('2026-09-10', '-30.00'), tx('2026-09-12', '-30.00')];
    const insight = buildInsight(summariseMonth(list, '2026-09'));
    expect(insight.text).not.toMatch(/so far this month/);
  });

  it('compares the month so far with the same days of last month', () => {
    // 20 November: £300 on groceries so far. By 20 October: £200.
    // The whole of October was £600, but that is not the comparison.
    const list = [tx('2026-11-04', '-300.00'), tx('2026-10-10', '-200.00'), tx('2026-10-25', '-400.00')];
    const summary = summariseMonth(list, '2026-11');
    expect(summary.categories[0]).toMatchObject({ pence: 30000, prevPence: 60000, pct: 50 });
    expect(buildInsight(summary).text).toBe('Groceries: £300 so far this month, 50% more than by the same day last month.');
  });

  it('describes a finished month against the whole of the month before', () => {
    const list = [tx('2026-10-05', '-90.00'), tx('2026-09-05', '-100.00')];
    expect(buildInsight(summariseMonth(list, '2026-10')).text)
      .toBe('Groceries: £90 in October, 10% less than in September.');
  });

  it('compares the 31st of a month with the end of a shorter month before it', () => {
    vi.setSystemTime(new Date('2026-12-31T12:00:00Z'));
    const list = [tx('2026-12-31', '-60.00'), tx('2026-11-30', '-40.00')];
    expect(summariseMonth(list, '2026-12').categories[0].pct).toBe(50);
  });

  it('copes with last month being £0: no Infinity, no NaN, no percentage', () => {
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    const summary = summariseMonth([tx('2026-10-05', '-45.00'), tx('2026-09-05', '1200.00', 'Income')], '2026-10');

    expect(summary.prevTotalPence).toBe(0);
    expect(summary.pctVsLastMonth).toBeNull();
    expect(summary.categories[0].pct).toBeNull();
    const { text } = buildInsight(summary);
    expect(text).toBe('Groceries is the largest spending category so far this month (£45). No spending was recorded by the same day last month.');
    expect(text).not.toMatch(/Infinity|NaN|%/);
  });

  it('copes with a category that did not exist last month', () => {
    const list = [
      tx('2026-10-05', '-120.00', 'Pet care'), // new this month
      tx('2026-10-06', '-60.00'),
      tx('2026-09-06', '-50.00'),
    ];
    const summary = summariseMonth(list, '2026-10');
    expect(summary.categories).toEqual([
      { name: 'Pet care', pence: 12000, prevPence: 0, pct: null },
      { name: 'Groceries', pence: 6000, prevPence: 5000, pct: 20 },
    ]);
    const { text } = buildInsight(summary);
    expect(text).toBe('Groceries: £60 in October, 20% more than in September.');
    expect(text).not.toMatch(/Infinity|NaN/);
  });

  it('when only new categories exist, names the largest without a percentage', () => {
    const summary = summariseMonth([tx('2026-10-05', '-8.50', 'Pet care'), tx('2026-09-06', '-50.00')], '2026-10');
    expect(buildInsight(summary).text).toBe('Pet care was the largest spending category in October (£8.50).');
  });

  it('describes past spending only, with no advice or value judgement', () => {
    const cases = [
      [tx('2026-10-05', '-90.00'), tx('2026-09-05', '-30.00')], // up
      [tx('2026-10-05', '-10.00'), tx('2026-09-05', '-90.00')], // down
      [tx('2026-10-05', '-30.00')], // nothing to compare
    ];
    for (const list of cases) {
      const insight = buildInsight(summariseMonth(list, '2026-10'));
      expect(insight.text).not.toMatch(/\b(should|consider|try|save|saving|budget|recommend|advice|cut|nice|well done|great|good job)\b/i);
    }
  });
});
