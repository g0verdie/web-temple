const PDFDocument = require('pdfkit');

/**
 * Generates an IRS-style donation tax receipt PDF (FR115). Temple identity comes
 * from env; until the temple supplies real values these render as clearly-marked
 * placeholders (never a crash) — see plan KTD4. Replace before issuing real receipts:
 *   TEMPLE_LEGAL_NAME, TEMPLE_EIN, TEMPLE_ADDRESS
 */
const templeName = () => process.env.TEMPLE_LEGAL_NAME || '[TEMPLE LEGAL NAME — set TEMPLE_LEGAL_NAME]';
const templeAddress = () => process.env.TEMPLE_ADDRESS || '[TEMPLE ADDRESS — set TEMPLE_ADDRESS]';
const templeEin = () => process.env.TEMPLE_EIN || '[EIN — set TEMPLE_EIN]';

const formatAmount = (amountCents) => `$${(Number(amountCents) / 100).toFixed(2)}`;

/**
 * @returns {Promise<Buffer>} the receipt PDF
 */
const generate = ({ amountCents, date, donorName, receiptId, isAnonymous }) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            doc.fontSize(18).text(templeName(), { align: 'center' });
            doc.fontSize(10).text(templeAddress(), { align: 'center' });
            doc.text(`EIN: ${templeEin()}`, { align: 'center' });
            doc.moveDown();
            doc.fontSize(14).text('Donation Tax Receipt', { align: 'center' });
            doc.moveDown();

            doc.fontSize(11);
            doc.text(`Receipt ID: ${receiptId}`);
            doc.text(`Date: ${date}`);
            if (!isAnonymous && donorName) {
                doc.text(`Donor: ${donorName}`);
            } else {
                doc.text('Donor: Anonymous');
            }
            doc.text(`Amount: ${formatAmount(amountCents)}`);
            doc.moveDown();

            doc.text(
                'This contribution is tax-deductible to the extent allowed by law. ' +
                'No goods or services were provided in exchange for this donation.'
            );
            doc.moveDown(2);
            doc.fontSize(9).fillColor('gray').text('Thank you for your generous support.', { align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = { generate, formatAmount };
