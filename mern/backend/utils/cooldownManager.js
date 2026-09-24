/**
 * In-memory cooldown manager for career.fmpg email dispatches
 * (Offer Letters, Certificates, and Application Notifications).
 */
const cooldownStore = new Map();

// Periodically clean up entries older than 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of cooldownStore.entries()) {
    if (now - timestamp > 5 * 60 * 1000) {
      cooldownStore.delete(key);
    }
  }
}, 60 * 1000).unref();

/**
 * Checks if a key is currently on cooldown.
 * @param {string} key Identifier (e.g. candidate email or entity id)
 * @param {number} cooldownSeconds Default 30 seconds
 * @returns {{ allowed: boolean, remainingSeconds: number }}
 */
function checkCooldown(key, cooldownSeconds = 30) {
  if (!key) return { allowed: true, remainingSeconds: 0 };
  const normalizedKey = String(key).trim().toLowerCase();
  const lastSent = cooldownStore.get(normalizedKey);

  if (!lastSent) {
    return { allowed: true, remainingSeconds: 0 };
  }

  const elapsedSeconds = Math.floor((Date.now() - lastSent) / 1000);
  if (elapsedSeconds < cooldownSeconds) {
    return {
      allowed: false,
      remainingSeconds: cooldownSeconds - elapsedSeconds,
    };
  }

  return { allowed: true, remainingSeconds: 0 };
}

/**
 * Records that an email was sent for a key.
 * @param {string} key
 */
function recordSend(key) {
  if (!key) return;
  const normalizedKey = String(key).trim().toLowerCase();
  cooldownStore.set(normalizedKey, Date.now());
}

module.exports = {
  checkCooldown,
  recordSend,
};
