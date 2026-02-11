const buildUnsubscribeLink = (token) => {
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const url = new URL('/unsubscribe', baseUrl);
    if (token) {
        url.searchParams.set('token', token);
    }
    return url.toString();
};

const appendUnsubscribe = ({ html, text }, token) => {
    const link = buildUnsubscribeLink(token);

    const htmlWithUnsubscribe = `${html}\n<hr>\n<p>If you no longer wish to receive these emails, <a href="${link}">unsubscribe here</a>.</p>`;
    const textWithUnsubscribe = `${text}\n\nUnsubscribe: ${link}`;

    return {
        html: htmlWithUnsubscribe,
        text: textWithUnsubscribe
    };
};

const templates = {
    welcome: (data = {}) => ({
        subject: 'Welcome to Temple B\'nai Israel',
        html: `<p>Shalom${data.name ? ` ${data.name}` : ''}!</p><p>Welcome to Temple B'nai Israel.</p>`,
        text: `Shalom${data.name ? ` ${data.name}` : ''}!\nWelcome to Temple B'nai Israel.`
    }),
    reset: (data = {}) => ({
        subject: 'Reset your Temple account password',
        html: `<p>We received a request to reset your password.</p><p><a href="${data.resetUrl || '#'}">Reset your password</a></p>`,
        text: `We received a request to reset your password.\nReset your password: ${data.resetUrl || ''}`
    }),
    receipt: (data = {}) => ({
        subject: 'Your Temple donation receipt',
        html: `<p>Thank you for your donation${data.amount ? ` of ${data.amount}` : ''}.</p><p>Receipt ID: ${data.receiptId || 'N/A'}</p>`,
        text: `Thank you for your donation${data.amount ? ` of ${data.amount}` : ''}.\nReceipt ID: ${data.receiptId || 'N/A'}`
    })
};

const renderTemplate = (templateKey, data = {}) => {
    const builder = templates[templateKey];
    if (!builder) {
        throw new Error(`Unknown email template: ${templateKey}`);
    }

    const base = builder(data);
    const withUnsubscribe = appendUnsubscribe(base, data.unsubscribeToken);

    return {
        subject: base.subject,
        html: withUnsubscribe.html,
        text: withUnsubscribe.text
    };
};

module.exports = {
    renderTemplate,
    buildUnsubscribeLink,
    templates
};
