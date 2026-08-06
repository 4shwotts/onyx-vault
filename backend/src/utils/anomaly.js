// Flags a transaction as anomalous if it's more than 3x the user's average
// spend in that category, based on their own history — a simple but genuine
// form of the "fraud/anomaly detection" pattern fintech systems use.
async function isAnomalous(client, userId, categoryId, amount) {
  if (!categoryId || amount >= 0) return false;

  const result = await client.query(
    `SELECT AVG(ABS(t.amount)) AS avg_amt, COUNT(*) AS cnt
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE a.user_id = $1 AND t.category_id = $2 AND t.amount < 0`,
    [userId, categoryId]
  );

  const { avg_amt, cnt } = result.rows[0];

  // Need at least 3 prior transactions in this category before we trust an average enough to flag against it
  if (Number(cnt) < 3 || !avg_amt) return false;

  return Math.abs(amount) > Number(avg_amt) * 3;
}

module.exports = { isAnomalous };