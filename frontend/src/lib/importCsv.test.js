import { describe, it, expect } from 'vitest';
import { parseStatementDate, parseStatementAmount, guessCategory, prepareImport } from './importCsv';

describe('parseStatementDate (UK day-first)', () => {
  it.each([
    ['01/08/2026', '2026-08-01'], // 1 August, never 8 January
    ['1/8/2026', '2026-08-01'],
    ['31/12/2026', '2026-12-31'],
    ['29/02/2028', '2028-02-29'],
    ['01-08-2026', '2026-08-01'],
    ['01.08.2026', '2026-08-01'],
    ['2026-08-01', '2026-08-01'],
    [' 15/03/2026 ', '2026-03-15'],
  ])('%j -> %s', (raw, expected) => {
    expect(parseStatementDate(raw)).toBe(expected);
  });

  it.each([
    ['31/02/2026'], // no 31st of February
    ['29/02/2026'], // not a leap year
    ['13/13/2026'],
    ['00/01/2026'],
    ['08/01/26'], // two-digit year
    ['2026/08/01'],
    ['1 Aug 2026'],
    [''],
    [undefined],
    ['01/08/1899'],
  ])('refuses %j', (raw) => {
    expect(parseStatementDate(raw)).toBeNull();
  });
});

describe('parseStatementAmount', () => {
  it.each([
    ['12.50', '12.50'],
    ['-12.5', '-12.50'],
    ['£1,234.56', '1234.56'],
    ['-£4.20', '-4.20'],
    ['(12.50)', '-12.50'],
    ['12.50 DR', '-12.50'],
    ['12.50 CR', '12.50'],
    ['+3', '3.00'],
    ['0.10', '0.10'],
  ])('%j -> %s', (raw, expected) => {
    expect(parseStatementAmount(raw)).toBe(expected);
  });

  it.each([['0'], ['0.00'], ['abc'], ['12.345'], ['1e3'], [''], ['1000000.00'], [undefined]])('refuses %j', (raw) => {
    expect(parseStatementAmount(raw)).toBeNull();
  });
});

describe('guessCategory', () => {
  it.each([
    ['Salary – Brambleworth Ltd', 'Income'],
    ['Fernhollow Grocers (supermarket)', 'Groceries'],
    ['Glimmerline Rail travel', 'Transport'],
    ['Pebblewick Coffee', 'Eating Out'],
    ['Quillby Energy', 'Bills'],
    ['Velvetreel Streaming subscription', 'Subscriptions'],
    ['Something unrecognisable', 'Other'],
    ['', 'Other'],
  ])('%j -> %s', (description, category) => {
    expect(guessCategory(description)).toBe(category);
  });
});

describe('prepareImport', () => {
  it('keeps good rows and lists every bad one by spreadsheet line, before anything is saved', () => {
    const { transactions, errors } = prepareImport([
      { Date: '01/08/2026', Description: 'Pebblewick Coffee', Amount: '-3.85' },
      { Date: '13/31/2026', Description: 'Bad date', Amount: '-1.00' },
      { Date: '02/08/2026', Description: 'Bad amount', Amount: 'twelve' },
      { Description: 'No date or amount' },
      { date: '2026-08-03', description: 'Lower-case headers', amount: '10' },
    ]);

    expect(transactions).toEqual([
      { id: 0, description: 'Pebblewick Coffee', amount: '-3.85', date: '2026-08-01', category: 'Eating Out' },
      { id: 4, description: 'Lower-case headers', amount: '10.00', date: '2026-08-03', category: 'Other' },
    ]);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5]);
    expect(errors[0].message).toMatch(/^Line 3: the date “13\/31\/2026”/);
    expect(errors[2].message).toBe('Line 5: no date; no amount.');
  });

  it('reads the sample file shipped with the app without errors', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const text = fs.readFileSync(path.resolve(__dirname, '../../public/sample-statement.csv'), 'utf8');
    const [header, ...lines] = text.trim().split(/\r?\n/);
    const keys = header.split(',');
    const rows = lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [keys[i], v])));
    const { transactions, errors } = prepareImport(rows);
    expect(errors).toEqual([]);
    expect(transactions).toHaveLength(10);
    expect(transactions[0]).toMatchObject({ date: '2026-10-28', amount: '2100.00', category: 'Income' });
  });
});
