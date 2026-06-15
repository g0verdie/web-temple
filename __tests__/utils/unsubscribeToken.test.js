const { signUnsubscribeToken, verifyUnsubscribeToken } = require('../../src/utils/unsubscribeToken');

describe('unsubscribeToken', () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const otherUserId = '22222222-2222-2222-2222-222222222222';

    it('round-trips: sign then verify returns the same userId', () => {
        const token = signUnsubscribeToken(userId);
        expect(verifyUnsubscribeToken(token)).toBe(userId);
    });

    it('returns null for a tampered HMAC (one char flipped)', () => {
        const token = signUnsubscribeToken(userId);
        const lastChar = token.slice(-1);
        const flipped = lastChar === 'A' ? 'B' : 'A';
        const tampered = token.slice(0, -1) + flipped;
        expect(verifyUnsubscribeToken(tampered)).toBeNull();
    });

    it('returns null when the token is re-pointed to a different userId', () => {
        const token = signUnsubscribeToken(userId);
        const hmac = token.split('.')[1];
        const repointed = `${otherUserId}.${hmac}`;
        expect(verifyUnsubscribeToken(repointed)).toBeNull();
    });

    it('returns null for malformed input', () => {
        expect(verifyUnsubscribeToken('')).toBeNull();
        expect(verifyUnsubscribeToken(null)).toBeNull();
        expect(verifyUnsubscribeToken(undefined)).toBeNull();
        expect(verifyUnsubscribeToken('no-dot-here')).toBeNull();
        expect(verifyUnsubscribeToken(userId)).toBeNull(); // only userId, no dot
        expect(verifyUnsubscribeToken(`${userId}.`)).toBeNull(); // empty hmac
        expect(verifyUnsubscribeToken(`${userId}.a.b`)).toBeNull(); // extra dots
    });

    it('returns null (no throw) for a wrong-length HMAC segment', () => {
        expect(() => verifyUnsubscribeToken(`${userId}.short`)).not.toThrow();
        expect(verifyUnsubscribeToken(`${userId}.short`)).toBeNull();
    });

    it('gives two users distinct tokens, neither verifying as the other', () => {
        const tokenA = signUnsubscribeToken(userId);
        const tokenB = signUnsubscribeToken(otherUserId);

        expect(tokenA).not.toBe(tokenB);
        expect(verifyUnsubscribeToken(tokenA)).toBe(userId);
        expect(verifyUnsubscribeToken(tokenB)).toBe(otherUserId);

        // Swapping userId prefixes between the two valid HMACs must fail.
        const swappedA = `${otherUserId}.${tokenA.split('.')[1]}`;
        const swappedB = `${userId}.${tokenB.split('.')[1]}`;
        expect(verifyUnsubscribeToken(swappedA)).toBeNull();
        expect(verifyUnsubscribeToken(swappedB)).toBeNull();
    });
});
