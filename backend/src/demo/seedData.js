// The made-up data a new demo account starts with: the current month and
// the three before it, in pounds sterling, so the charts, comparisons and
// spend insight have something meaningful to show straight away.
//
// Every shop, employer and service named here is fictional. None is a
// real brand.
//
// buildDemoData(today) is a pure function of the date: no database, no
// clock, no randomness beyond a fixed-seed generator, so tests can check
// exactly what it produces.

const { nextDate } = require('../utils/schedule');

const ACCOUNTS = [
  { key: 'current', name: 'Current', type: 'current' },
  { key: 'savings', name: 'Savings', type: 'savings' },
];

const CATEGORIES = ['Income', 'Bills', 'Groceries', 'Subscriptions', 'Transport', 'Eating Out', 'Entertainment', 'Shopping'];

// Fixed monthly payments: [day of month, description, category, pence].
// Negative pence = money out.
const MONTHLY = [
  [1, 'Rent – Larchmont Lettings', 'Bills', -89500],
  [3, 'Ironbark Gym membership', 'Subscriptions', -2999],
  [10, 'Tidewire Broadband', 'Bills', -3200],
  [19, 'Lyrebird Music Plan', 'Subscriptions', -1199],
  [22, 'Pinecrest Mobile', 'Bills', -1800],
];

// The two monthly payments that are also set up as recurring rules.
const RULES = [
  { day: 28, description: 'Salary – Brambleworth Ltd', category: 'Income', pence: 245000 },
  { day: 14, description: 'Velvetreel Streaming', category: 'Subscriptions', pence: -1099 },
];

// Fictional names that the irregular spending is drawn from.
const GROCERS = ['Fernhollow Grocers', 'Hollowmere Market', 'Bramblegate Bakery'];
const CAFES = ['Pebblewick Coffee', 'Copperleaf Café'];
const RESTAURANTS = ['Saltmarsh Bistro', 'Juniper & Rye Kitchen'];

// Small, fixed-seed pseudo-random generator (mulberry32), so a given day
// always produces the same demo data.
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function key(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function daysIn(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addDays(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return key(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

// First day of the month `back` months before the given date's month.
function monthStart(dateKey, back) {
  let [y, m] = dateKey.split('-').map(Number);
  m -= back;
  while (m < 1) { m += 12; y -= 1; }
  return key(y, m, 1);
}

function between(rand, minPence, maxPence) {
  return Math.round(minPence + rand() * (maxPence - minPence));
}

function buildDemoData(today, { monthsBack = 3 } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`Not a date: ${today}`);
  const rand = seededRandom(20261109);
  const start = monthStart(today, monthsBack);
  const transactions = [];
  const add = (account, date, description, category, pence, extra = {}) => {
    if (date >= start && date <= today) {
      transactions.push({ account, date, description, category, pence, isRecurring: false, isAnomaly: false, ...extra });
    }
  };

  // Monthly payments, rules' past payments and savings, month by month.
  for (let back = monthsBack; back >= 0; back -= 1) {
    const [y, m] = monthStart(today, back).split('-').map(Number);
    const last = daysIn(y, m);
    for (const [day, description, category, pence] of MONTHLY) {
      add('current', key(y, m, Math.min(day, last)), description, category, pence);
    }
    // Energy varies a little month to month.
    add('current', key(y, m, 5), 'Quillby Energy', 'Bills', -between(rand, 6200, 7800));
    // A small clothes purchase early each month, so Shopping has something
    // to compare against like for like (not only the odd big purchase).
    add('current', key(y, m, 4), 'Marrowby Outfitters', 'Shopping', -between(rand, 1800, 4500));
    for (const rule of RULES) {
      add('current', key(y, m, Math.min(rule.day, last)), rule.description, rule.category, rule.pence, { isRecurring: true });
    }
    add('savings', key(y, m, Math.min(30, last)), 'Savings interest', 'Income', between(rand, 280, 360));
  }
  add('savings', start, 'Opening balance', 'Income', 180000);

  // Day-to-day spending: a big grocery shop every week (on the 3rd, 10th,
  // 17th, 24th and 31st, so every month has the same pattern), with
  // smaller top-up shops in between.
  for (let date = start; date <= today; date = addDays(date, 1)) {
    const day = Number(date.slice(8, 10));
    if (day % 7 === 3) add('current', date, 'Fernhollow Grocers', 'Groceries', -between(rand, 4500, 7500));
    else if (rand() < 0.15) add('current', date, GROCERS[Math.floor(rand() * GROCERS.length)], 'Groceries', -between(rand, 350, 2000));
    if (rand() < 0.28) add('current', date, CAFES[Math.floor(rand() * CAFES.length)], 'Eating Out', -between(rand, 280, 460));
    if (rand() < 0.25) add('current', date, 'Glimmerline Rail', 'Transport', -between(rand, 420, 1430));
    if (rand() < 0.07) add('current', date, RESTAURANTS[Math.floor(rand() * RESTAURANTS.length)], 'Eating Out', -between(rand, 2400, 4800));
    if (rand() < 0.05) add('current', date, 'Hollowmere Homewares', 'Shopping', -between(rand, 1200, 6000));
    if (day === 16 && rand() < 0.9) add('current', date, 'Starfall Cinema', 'Entertainment', -between(rand, 950, 2200));
  }

  // One clearly unusual purchase, to show the anomaly flag.
  const unusualDate = addDays(today, -9) >= start ? addDays(today, -9) : today;
  add('current', unusualDate, 'Hollowmere Homewares (sofa)', 'Shopping', -24900, { isAnomaly: true });

  transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // The rules continue from their next due date after today.
  const rules = RULES.map((rule) => {
    const [y, m] = today.split('-').map(Number);
    let next = key(y, m, Math.min(rule.day, daysIn(y, m)));
    if (next <= today) next = nextDate(next, 'monthly', rule.day);
    const firstPayment = transactions.find((t) => t.description === rule.description);
    return {
      account: 'current',
      description: rule.description,
      category: rule.category,
      pence: rule.pence,
      frequency: 'monthly',
      dayOfMonth: rule.day,
      startDate: firstPayment ? firstPayment.date : next,
      nextRunDate: next,
    };
  });

  return { accounts: ACCOUNTS, categories: CATEGORIES, transactions, rules };
}

module.exports = { buildDemoData };
