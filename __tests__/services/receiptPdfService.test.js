const { generate, formatAmount } = require('../../src/services/receiptPdfService');

describe('receiptPdfService', () => {
    test('formatAmount renders dollars from cents', () => {
        expect(formatAmount(1800)).toBe('$18.00');
        expect(formatAmount(10001)).toBe('$100.01');
    });

    test('generates a valid PDF buffer for a named donor', async () => {
        const pdf = await generate({
            amountCents: 3600, date: '2026-06-14', donorName: 'Ada Lovelace',
            receiptId: 'RCPT-1', isAnonymous: false
        });
        expect(Buffer.isBuffer(pdf)).toBe(true);
        expect(pdf.slice(0, 5).toString()).toBe('%PDF-');
        expect(pdf.length).toBeGreaterThan(500);
    });

    test('generates a valid PDF for an anonymous donor without throwing', async () => {
        const pdf = await generate({ amountCents: 1800, date: '2026-06-14', receiptId: 'RCPT-2', isAnonymous: true });
        expect(pdf.slice(0, 5).toString()).toBe('%PDF-');
    });

    test('renders placeholders (no crash) when temple identity env is unset', async () => {
        const saved = {
            n: process.env.TEMPLE_LEGAL_NAME,
            e: process.env.TEMPLE_EIN,
            a: process.env.TEMPLE_ADDRESS
        };
        delete process.env.TEMPLE_LEGAL_NAME;
        delete process.env.TEMPLE_EIN;
        delete process.env.TEMPLE_ADDRESS;
        try {
            const pdf = await generate({ amountCents: 100, date: '2026-06-14', receiptId: 'RCPT-3', isAnonymous: false });
            expect(pdf.slice(0, 5).toString()).toBe('%PDF-');
        } finally {
            if (saved.n) process.env.TEMPLE_LEGAL_NAME = saved.n;
            if (saved.e) process.env.TEMPLE_EIN = saved.e;
            if (saved.a) process.env.TEMPLE_ADDRESS = saved.a;
        }
    });
});
