// Fire-and-forget work that must not hold up the response that started it
// (e.g. catching up a user's recurring payments after they log in).
// Failures are logged, never thrown at the caller.
const pending = new Set();

function runInBackground(label, task) {
  const promise = Promise.resolve()
    .then(task)
    .catch((err) => console.error(`${label} failed:`, err.message))
    .finally(() => pending.delete(promise));
  pending.add(promise);
  return promise;
}

// For tests and graceful shutdown: resolves once nothing is in flight.
async function settleBackgroundWork() {
  while (pending.size > 0) {
    await Promise.allSettled([...pending]);
  }
}

module.exports = { runInBackground, settleBackgroundWork };
