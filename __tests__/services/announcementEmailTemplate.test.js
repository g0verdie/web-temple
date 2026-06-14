const { renderTemplate } = require('../../src/services/emailTemplateService');

describe('announcement-notification email template (U3)', () => {
    it('builds subject, body, homepage link, and unsubscribe footer', () => {
        const result = renderTemplate('announcement-notification', {
            title: 'Shabbat',
            bodyHtml: '<p>Join us</p>',
            bodyText: 'Join us',
            memberName: 'Dana',
            homeUrl: 'https://temple.example.com'
        });

        expect(result.subject).toBe('New Announcement: Shabbat');
        expect(result.html).toContain('<p>Join us</p>');
        expect(result.html).toContain('https://temple.example.com');
        expect(result.html).toContain('Dana');
        // Generic appendUnsubscribe footer (FR88) is applied (non-exempt key).
        expect(result.html).toContain('unsubscribe');
        expect(result.text).toContain('Join us');
        expect(result.text).toContain('Unsubscribe:');
    });

    it('falls back to a default subject when title is missing', () => {
        const result = renderTemplate('announcement-notification', { bodyHtml: '<p>x</p>', bodyText: 'x' });
        expect(result.subject).toBe('New Announcement: Temple Announcement');
    });

    it('still throws on an unknown template key (regression guard)', () => {
        expect(() => renderTemplate('does-not-exist', {})).toThrow('Unknown email template');
    });
});
