// The default set of categories offered wherever a user picks or
// filters by category (the Transactions "Add" form, the filter
// dropdown, CSV import previews). 'Other' comes first since it's the
// fallback category used throughout the app whenever no category is
// specified. These aren't the only categories that can exist — users
// implicitly create custom ones too (see resolveCategoryId in
// Transactions.jsx) — this list is just the starting set always shown
// alongside whatever custom ones a user has added.
export const BASE_CATEGORIES = [
  'Other',
  'Individual',
  'Groceries',
  'Subscriptions',
  'Transport',
  'Income',
  'Eating Out',
  'Entertainment',
  'Shopping',
  'Bills',
];