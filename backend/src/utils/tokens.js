const crypto = require('crypto');

// Generates a random token to email to the user, plus its SHA 256 hash to
// store in the database. Only the hash is persisted, so a leaked database
// row can't be used to forge a valid token, the same reasoning as never
// storing plaintext passwords.
function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateToken, hashToken };