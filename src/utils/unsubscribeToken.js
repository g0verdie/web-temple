const crypto = require('crypto');

/**
 * Stateless signed token for one-click email unsubscribe (CAN-SPAM).
 *
 * Format: "<userId>.<base64url-HMAC-SHA256>". The HMAC covers a fixed purpose
 * label plus the userId so a token signed for unsubscribe cannot be reused for
 * any other purpose, and so the raw users.id UUID is never trusted on its own.
 *
 * Secret: UNSUBSCRIBE_TOKEN_SECRET, falling back to JWT_SECRET. No expiry —
 * CAN-SPAM opt-out links must remain valid indefinitely.
 */

const PURPOSE = 'unsubscribe';

const getSecret = () => process.env.UNSUBSCRIBE_TOKEN_SECRET || process.env.JWT_SECRET || '';

const computeHmac = (userId) =>
    crypto
        .createHmac('sha256', getSecret())
        .update(`${PURPOSE}:${userId}`)
        .digest('base64url');

const signUnsubscribeToken = (userId) => `${userId}.${computeHmac(userId)}`;

const verifyUnsubscribeToken = (token) => {
    if (typeof token !== 'string' || token.length === 0) {
        return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
        return null;
    }

    const [userId, providedHmac] = parts;
    if (!userId || !providedHmac) {
        return null;
    }

    const expectedHmac = computeHmac(userId);
    const providedBuf = Buffer.from(providedHmac);
    const expectedBuf = Buffer.from(expectedHmac);

    // Length guard first so timingSafeEqual never throws on mismatched buffers.
    if (providedBuf.length !== expectedBuf.length) {
        return null;
    }

    if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        return null;
    }

    return userId;
};

module.exports = {
    signUnsubscribeToken,
    verifyUnsubscribeToken,
};
