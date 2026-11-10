// Always the page's own origin: '/api' is proxied to the backend by Vercel
// in production (vercel.json) and by Vite in development (vite.config.js).
// Keeping every call same-origin is what lets the session cookie be
// SameSite=Lax — a direct call to the Render URL would be cross-site and
// the browser would not send the cookie. VITE_API_URL can still override
// it, but should normally be left unset.
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.status = res.status;
    throw err;
  }

  return data;
}

function notifyDataChanged() {
  window.dispatchEvent(new Event('app-data-changed'));
}

async function mutating(promise) {
  const result = await promise;
  notifyDataChanged();
  return result;
}

export const api = {
  register: (email, password, honeypot = '', formRenderedAt = null) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, honeypot, formRenderedAt }),
    }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  // Starts a throwaway demo account and signs it in.
  startDemo: () => request('/auth/demo', { method: 'POST' }),
  // Public settings (e.g. whether sign-up is open). No session needed.
  getConfig: () => request('/config'),
  // Wakes the sleeping server and its database (see hooks/useWakeServer.js).
  wake: (signal) => request('/wake', { signal }),
  verifyEmail: (token) =>
    request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  resendVerification: (email) =>
    request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  deleteMyAccount: (password) =>
    request('/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) }),

  getAccounts: () => request('/accounts'),
  createAccount: (name, type) =>
    mutating(request('/accounts', { method: 'POST', body: JSON.stringify({ name, type }) })),
  deleteAccount: (id) => mutating(request(`/accounts/${id}`, { method: 'DELETE' })),

  getCategories: () => request('/categories'),
  createCategory: (name) =>
    mutating(request('/categories', { method: 'POST', body: JSON.stringify({ name }) })),

  updateCategory: (id, name) =>
    mutating(request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })),
  deleteCategory: (id) => mutating(request(`/categories/${id}`, { method: 'DELETE' })),

  // Every matching transaction (used for charts and the month list).
  getTransactions: (params = '') => request(`/transactions${params}`),
  // One page: { transactions, page, limit, total, totalPages, totals }.
  getTransactionsPage: (query) => request(`/transactions?${new URLSearchParams(query).toString()}`),
  getTransaction: (id) => request(`/transactions/${id}`),
  createTransaction: (data) =>
    mutating(request('/transactions', { method: 'POST', body: JSON.stringify(data) })),
  updateTransaction: (id, data) =>
    mutating(request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) })),
  deleteTransaction: (id) => mutating(request(`/transactions/${id}`, { method: 'DELETE' })),

  getRecurring: () => request('/recurring'),
  createRecurring: (data) =>
    mutating(request('/recurring', { method: 'POST', body: JSON.stringify(data) })),
  updateRecurring: (id, data) =>
    mutating(request(`/recurring/${id}`, { method: 'PUT', body: JSON.stringify(data) })),
  deleteRecurring: (id) => mutating(request(`/recurring/${id}`, { method: 'DELETE' })),
  runRecurringNow: () => mutating(request('/recurring/run-now', { method: 'POST' })),
};