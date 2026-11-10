import { useId, useState } from 'react';
import { BASE_CATEGORIES } from '../constants/categories';
import { validateTransactionForm } from '../lib/transactionForm';
import { todayKey, toDateKey } from '../utils/dates';
import { toPence } from '../utils/money';

// Add or edit a transaction. Every field has a label (visually hidden, to
// keep the compact design) and its own error message, linked with
// aria-describedby so screen readers read the problem with the field.
//
// onSubmit receives { accountId, categoryName, amount, isExpense,
// description, date, makeRecurring, frequency } once the values are valid.
export default function TransactionForm({
  mode = 'add',
  accounts,
  categoryNames = [],
  initial,
  onSubmit,
  onCancel,
  style,
}) {
  const id = useId();
  const initialPence = initial ? toPence(initial.amount) : null;
  const [values, setValues] = useState(() => ({
    accountId: initial ? String(initial.account_id) : '',
    description: initial?.description || '',
    categoryName: initial?.category_name || '',
    amount: initialPence !== null ? (Math.abs(initialPence) / 100).toFixed(2) : '',
    isExpense: initialPence !== null ? initialPence < 0 : true,
    date: initial ? toDateKey(initial.date) : todayKey(),
    makeRecurring: false,
    frequency: 'monthly',
  }));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const allCategories = [...new Set([...BASE_CATEGORIES, ...categoryNames, values.categoryName].filter(Boolean))];

  function update(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    const found = validateTransactionForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(`${id}-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldProps = (field) => ({
    id: `${id}-${field}`,
    'aria-invalid': errors[field] ? 'true' : undefined,
    'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined,
  });
  const errorText = (field) => errors[field] && (
    <p id={`${id}-${field}-error`} className="font-mono" style={errorStyle}>{errors[field]}</p>
  );
  const isEdit = mode === 'edit';

  return (
    <form onSubmit={handleSubmit} noValidate aria-label={isEdit ? 'Edit transaction' : 'Add transaction'} style={{ ...formStyle, ...style }}>
      <label htmlFor={`${id}-accountId`} className="visually-hidden">Account</label>
      <select {...fieldProps('accountId')} value={values.accountId} onChange={(e) => update('accountId', e.target.value)} className="font-mono" style={selectStyle}>
        <option value="">Select account</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      {errorText('accountId')}

      <label htmlFor={`${id}-description`} className="visually-hidden">Description</label>
      <input {...fieldProps('description')} type="text" placeholder="Description (e.g. Corner shop)" maxLength={255}
        value={values.description} onChange={(e) => update('description', e.target.value)} className="font-mono" style={inputStyle} />
      {errorText('description')}

      <label htmlFor={`${id}-categoryName`} className="visually-hidden">Category</label>
      <select {...fieldProps('categoryName')} value={values.categoryName} onChange={(e) => update('categoryName', e.target.value)} className="font-mono" style={selectStyle}>
        <option value="">Category</option>
        {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <label htmlFor={`${id}-amount`} className="visually-hidden">Amount in pounds</label>
        <input {...fieldProps('amount')} type="text" inputMode="decimal" placeholder="Amount (£)" value={values.amount}
          onChange={(e) => update('amount', e.target.value)} className="font-mono" style={{ ...inputStyle, marginBottom: 0, flex: 1, minWidth: 0 }} />
        <label htmlFor={`${id}-type`} className="visually-hidden">Money in or out</label>
        <select id={`${id}-type`} value={values.isExpense ? 'expense' : 'income'} onChange={(e) => update('isExpense', e.target.value === 'expense')}
          className="font-mono" style={{ ...selectStyle, marginBottom: 0, width: 130 }}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>
      {errorText('amount')}

      <label htmlFor={`${id}-date`} className="visually-hidden">Date</label>
      <input {...fieldProps('date')} type="date" value={values.date} onChange={(e) => update('date', e.target.value)} className="font-mono" style={inputStyle} />
      {errorText('date')}

      {!isEdit && (
        <label className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#bbb', marginBottom: values.makeRecurring ? 10 : 14 }}>
          <input type="checkbox" checked={values.makeRecurring} onChange={(e) => update('makeRecurring', e.target.checked)} />
          Make this recurring
        </label>
      )}
      {!isEdit && values.makeRecurring && (
        <>
          <label htmlFor={`${id}-frequency`} className="visually-hidden">How often</label>
          <select id={`${id}-frequency`} value={values.frequency} onChange={(e) => update('frequency', e.target.value)} className="font-mono" style={selectStyle}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </>
      )}

      {submitError && <p role="alert" className="font-mono" style={errorStyle}>{submitError}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        {onCancel && (
          <button type="button" onClick={onCancel} className="font-mono" style={{ ...buttonStyle, background: 'transparent', border: '0.5px solid #444', flex: 1 }}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={submitting} className="font-mono" style={{ ...buttonStyle, flex: 2 }}>
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : values.makeRecurring ? 'Create recurring rule' : 'Add transaction'}
        </button>
      </div>
    </form>
  );
}

const formStyle = { background: '#141414', borderRadius: 12, padding: 22 };
const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '0.5px solid #333',
  borderRadius: 8, padding: '12px 14px', fontSize: 14, color: '#fff', marginBottom: 10,
};
const selectStyle = {
  width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '0.5px solid #333',
  borderRadius: 8, padding: '12px 40px 12px 14px', fontSize: 14, color: '#fff', marginBottom: 10,
  appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e5e5e5' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', backgroundSize: '13px',
};
const buttonStyle = {
  background: '#2a2f33', color: '#fff', border: 'none', borderRadius: 8,
  padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const errorStyle = { color: '#ff8a8a', fontSize: 12, margin: '-4px 0 10px', lineHeight: 1.4 };
