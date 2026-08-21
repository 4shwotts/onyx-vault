const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
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
    request('/accounts', { method: 'POST', body: JSON.stringify({ name, type }) }),
  deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
  getCategories: () => request('/categories'),
  createCategory: (name) =>
    request('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  getTransactions: (params = '') => request(`/transactions${params}`),
  createTransaction: (data) =>
    request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  getRecurring: () => request('/recurring'),
  createRecurring: (data) =>
    request('/recurring', { method: 'POST', body: JSON.stringify(data) }),
  deleteRecurring: (id) => request(`/recurring/${id}`, { method: 'DELETE' }),
  runRecurringNow: () => request('/recurring/run-now', { method: 'POST' }),
};