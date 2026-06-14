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

const UNSUBSCRIBE_EXEMPT = new Set([
    'password-reset',
    'password-changed-notification',
    'reset',
    'email-change-confirmation'
]);

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
    'password-reset': (data = {}) => ({
        subject: 'Reset your Temple account password',
        html: `<p>Shalom${data.name ? ` ${data.name}` : ''}.</p>
               <p>We received a request to reset the password for your Temple B'nai Israel account.</p>
               <p>Please click the link below to set a new password:</p>
               <p><a href="${data.resetLink}">Reset Password</a></p>
               <p>This link will expire in 24 hours.</p>
               <p>If you did not request this change, you can safely ignore this email.</p>`,
        text: `Shalom${data.name ? ` ${data.name}` : ''}.\n\nWe received a request to reset the password for your Temple B'nai Israel account.\n\nPlease use the link below to set a new password:\n${data.resetLink}\n\nThis link will expire in 24 hours.\n\nIf you did not request this change, you can safely ignore this email.`
    }),
    'password-changed-notification': (data = {}) => ({
        subject: 'Your Temple account password has been changed',
        html: `<p>Shalom${data.name ? ` ${data.name}` : ''}.</p>
               <p>This email is to confirm that the password for your Temple B'nai Israel account has been successfully changed.</p>
               <p>If you did not make this change, please contact the temple administration immediately.</p>`,
        text: `Shalom${data.name ? ` ${data.name}` : ''}.\n\nThis email is to confirm that the password for your Temple B'nai Israel account has been successfully changed.\n\nIf you did not make this change, please contact the temple administration immediately.`
    }),
    'email-change-confirmation': (data = {}) => ({
        subject: 'Confirm your new email address',
        html: `<p>We received a request to update the email address for your Temple B'nai Israel account.</p>
               <p>Please confirm your new email address by clicking the link below:</p>
               <p><a href="${data.confirmLink}">Confirm Email</a></p>
               <p>If you did not request this change, you can ignore this email.</p>`,
        text: `We received a request to update the email address for your Temple B'nai Israel account.

Please confirm your new email address:
${data.confirmLink}

If you did not request this change, you can ignore this email.`
    }),
    receipt: (data = {}) => ({
        subject: 'Your Temple donation receipt',
        html: `<p>Shalom${data.name ? ` ${data.name}` : ''},</p>
               <p>Thank you for your generous donation${data.amount ? ` of ${data.amount}` : ''} to Temple B'nai Israel.</p>
               <p>Your official tax receipt is attached as a PDF for your records (Receipt ID: ${data.receiptId || 'N/A'}).</p>
               <p>This contribution is tax-deductible to the extent allowed by law; no goods or services were provided in exchange.</p>`,
        text: `Shalom${data.name ? ` ${data.name}` : ''},\n\nThank you for your generous donation${data.amount ? ` of ${data.amount}` : ''} to Temple B'nai Israel.\n\nYour official tax receipt is attached as a PDF for your records (Receipt ID: ${data.receiptId || 'N/A'}).\n\nThis contribution is tax-deductible to the extent allowed by law; no goods or services were provided in exchange.`
    }),
    'new-recording-available': (data = {}) => ({
        subject: 'New Recording: ' + (data.title || 'Service Recording'),
        html: `<p>Shalom${data.memberName ? ` ${data.memberName}` : ''}!</p>
               <p>A new service recording is now available in our archive: <strong>${data.title || 'Service Recording'}</strong></p>
               ${data.serviceDate ? `<p>Service Date: ${new Date(data.serviceDate).toDateString()}</p>` : ''}
               ${data.torahPortion ? `<p>Torah Portion: ${data.torahPortion}</p>` : ''}
               <p><a href="${data.archiveUrl || '#'}">View Recording</a></p>`,
        text: `Shalom${data.memberName ? ` ${data.memberName}` : ''}!\n\nA new service recording is now available in our archive: ${data.title || 'Service Recording'}\n${data.serviceDate ? `Service Date: ${new Date(data.serviceDate).toDateString()}\n` : ''}${data.torahPortion ? `Torah Portion: ${data.torahPortion}\n` : ''}View Recording: ${data.archiveUrl || '#'}`
    }),
    'announcement-notification': (data = {}) => {
        const homeUrl = data.homeUrl || process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
        return {
            subject: 'New Announcement: ' + (data.title || 'Temple Announcement'),
            // data.bodyHtml is server-sanitized on write (AnnouncementService, KTD2), safe to embed.
            html: `<p>Shalom${data.memberName ? ` ${data.memberName}` : ''}!</p>
               ${data.bodyHtml || ''}
               <p><a href="${homeUrl}">View on the website</a></p>`,
            text: `Shalom${data.memberName ? ` ${data.memberName}` : ''}!\n\n${data.bodyText || ''}\n\nView on the website: ${homeUrl}`
        };
    }

};

const renderTemplate = (templateKey, data = {}) => {
    const builder = templates[templateKey];
    if (!builder) {
        throw new Error(`Unknown email template: ${templateKey}`);
    }

    const base = builder(data);

    if (UNSUBSCRIBE_EXEMPT.has(templateKey)) {
        return {
            subject: base.subject,
            html: base.html,
            text: base.text
        };
    }

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
