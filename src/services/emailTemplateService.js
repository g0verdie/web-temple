// Format an event date/time for calendar emails. Tolerates Date or string input
// and degrades gracefully when the value is missing or unparseable.
const formatEventDateTime = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit'
    });
};

const formatEventTime = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
};

// Escape user-authored text before embedding it in email HTML. Calendar event
// fields (title/description/location/zoomUrl) are staff-authored and fan out to
// every opted-in member, so they must be escaped at this sink (security review).
const htmlEscape = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Only emit an href for http(s) URLs; neutralise javascript:/data:/etc.
const safeHttpUrl = (value) => {
    const s = String(value == null ? '' : value).trim();
    return /^https?:\/\//i.test(s) ? s : '#';
};

const buildUnsubscribeLink = (token) => {
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const url = new URL('/unsubscribe', baseUrl);
    if (token) {
        url.searchParams.set('token', token);
    }
    return url.toString();
};

// RFC 8058 one-click unsubscribe headers. The URL reuses buildUnsubscribeLink so
// the header target and the in-body link are always the same endpoint+token.
// Gmail/Yahoo (2024+ bulk rules) POST `List-Unsubscribe=One-Click` to this URL.
const buildUnsubscribeHeaders = (token) => ({
    'List-Unsubscribe': `<${buildUnsubscribeLink(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
});

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
    },
    'new-event': (data = {}) => ({
        subject: `New Temple Event: ${data.title || 'Event'}`,
        html: `<p>Shalom${data.memberName ? ` ${data.memberName}` : ''}!</p>
               <p>A new event has been added to the temple calendar: <strong>${htmlEscape(data.title || 'Event')}</strong></p>
               ${data.date ? `<p>When: ${formatEventDateTime(data.date)}</p>` : ''}
               ${data.location ? `<p>Where: ${htmlEscape(data.location)}</p>` : ''}
               ${data.zoomUrl ? `<p>Join online: <a href="${safeHttpUrl(data.zoomUrl)}">${htmlEscape(data.zoomUrl)}</a></p>` : ''}
               ${data.description ? `<p>${htmlEscape(data.description)}</p>` : ''}
               <p>An "Add to Calendar" file is attached.</p>
               <p><a href="${data.calendarUrl || '#'}">View the calendar</a></p>`,
        text: `Shalom${data.memberName ? ` ${data.memberName}` : ''}!\n\nA new event has been added to the temple calendar: ${data.title || 'Event'}\n${data.date ? `When: ${formatEventDateTime(data.date)}\n` : ''}${data.location ? `Where: ${data.location}\n` : ''}${data.zoomUrl ? `Join online: ${data.zoomUrl}\n` : ''}${data.description ? `\n${data.description}\n` : ''}\nAn "Add to Calendar" file is attached.\nView the calendar: ${data.calendarUrl || '#'}`
    }),
    'event-updated': (data = {}) => ({
        subject: `Event Updated: ${data.title || 'Event'}`,
        html: `<p>Shalom${data.memberName ? ` ${data.memberName}` : ''}!</p>
               <p>An event on the temple calendar has been updated: <strong>${htmlEscape(data.title || 'Event')}</strong></p>
               ${data.date ? `<p>When: ${formatEventDateTime(data.date)}</p>` : ''}
               ${data.location ? `<p>Where: ${htmlEscape(data.location)}</p>` : ''}
               ${data.zoomUrl ? `<p>Join online: <a href="${safeHttpUrl(data.zoomUrl)}">${htmlEscape(data.zoomUrl)}</a></p>` : ''}
               ${data.description ? `<p>${htmlEscape(data.description)}</p>` : ''}
               <p>An updated "Add to Calendar" file is attached.</p>
               <p><a href="${data.calendarUrl || '#'}">View the calendar</a></p>`,
        text: `Shalom${data.memberName ? ` ${data.memberName}` : ''}!\n\nAn event on the temple calendar has been updated: ${data.title || 'Event'}\n${data.date ? `When: ${formatEventDateTime(data.date)}\n` : ''}${data.location ? `Where: ${data.location}\n` : ''}${data.zoomUrl ? `Join online: ${data.zoomUrl}\n` : ''}${data.description ? `\n${data.description}\n` : ''}\nAn updated "Add to Calendar" file is attached.\nView the calendar: ${data.calendarUrl || '#'}`
    }),
    'event-canceled': (data = {}) => ({
        subject: `Event Canceled: ${data.title || 'Event'}`,
        html: `<p>Shalom${data.memberName ? ` ${data.memberName}` : ''}.</p>
               <p>The following event has been canceled: <strong>${htmlEscape(data.title || 'Event')}</strong></p>
               ${data.date ? `<p>Originally scheduled for: ${formatEventDateTime(data.date)}</p>` : ''}
               <p>We apologize for any inconvenience.</p>
               <p><a href="${data.calendarUrl || '#'}">View the calendar</a></p>`,
        text: `Shalom${data.memberName ? ` ${data.memberName}` : ''}.\n\nThe following event has been canceled: ${data.title || 'Event'}\n${data.date ? `Originally scheduled for: ${formatEventDateTime(data.date)}\n` : ''}\nWe apologize for any inconvenience.\nView the calendar: ${data.calendarUrl || '#'}`
    }),
    'event-reminder': (data = {}) => ({
        subject: `Reminder: ${data.title || 'Event'} tomorrow at ${formatEventTime(data.date)}`,
        html: `<p>Shalom${data.memberName ? ` ${data.memberName}` : ''}!</p>
               <p>This event starts in 24 hours: <strong>${htmlEscape(data.title || 'Event')}</strong></p>
               ${data.date ? `<p>When: ${formatEventDateTime(data.date)}</p>` : ''}
               ${data.location ? `<p>Where: ${htmlEscape(data.location)}</p>` : ''}
               ${data.zoomUrl ? `<p>Join online: <a href="${safeHttpUrl(data.zoomUrl)}">${htmlEscape(data.zoomUrl)}</a></p>` : ''}
               ${data.description ? `<p>${htmlEscape(data.description)}</p>` : ''}
               <p>An "Add to Calendar" file is attached.</p>
               <p><a href="${data.calendarUrl || '#'}">View the calendar</a></p>`,
        text: `Shalom${data.memberName ? ` ${data.memberName}` : ''}!\n\nThis event starts in 24 hours: ${data.title || 'Event'}\n${data.date ? `When: ${formatEventDateTime(data.date)}\n` : ''}${data.location ? `Where: ${data.location}\n` : ''}${data.zoomUrl ? `Join online: ${data.zoomUrl}\n` : ''}${data.description ? `\n${data.description}\n` : ''}\nAn "Add to Calendar" file is attached.\nView the calendar: ${data.calendarUrl || '#'}`
    })

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
        text: withUnsubscribe.text,
        headers: buildUnsubscribeHeaders(data.unsubscribeToken)
    };
};

module.exports = {
    renderTemplate,
    buildUnsubscribeLink,
    templates
};
