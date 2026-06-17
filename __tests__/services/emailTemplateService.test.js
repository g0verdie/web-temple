const emailTemplateService = require('../../src/services/emailTemplateService');

describe('emailTemplateService', () => {
    test('renders welcome template with unsubscribe link', () => {
        const rendered = emailTemplateService.renderTemplate('welcome', { name: 'Ilya' });

        expect(rendered.subject).toContain('Welcome');
        expect(rendered.html).toContain('unsubscribe');
        expect(rendered.text).toContain('Unsubscribe');
        expect(rendered.html).toContain('Ilya');
    });

    test('renders reset template without unsubscribe link', () => {
        const rendered = emailTemplateService.renderTemplate('reset', {
            resetUrl: 'https://example.com/reset',
            unsubscribeToken: 'token-123'
        });

        expect(rendered.html).toContain('reset');
        expect(rendered.text).toContain('reset');
        expect(rendered.html).not.toContain('unsubscribe');
        expect(rendered.text).not.toContain('Unsubscribe');
    });

    test('throws for unknown template', () => {
        expect(() => emailTemplateService.renderTemplate('unknown-template')).toThrow('Unknown email template');
    });

    describe('calendar templates (U8)', () => {
        const eventData = {
            memberName: 'Ilya',
            title: 'Kabbalat Shabbat',
            date: new Date('2099-07-10T19:00:00Z'),
            location: 'Main Sanctuary',
            zoomUrl: 'https://zoom.us/j/1',
            description: 'A welcoming service',
            calendarUrl: 'https://temple.example.com/calendar',
            unsubscribeToken: 'tok-1'
        };

        test('new-event renders subject, fields, and unsubscribe footer', () => {
            const r = emailTemplateService.renderTemplate('new-event', eventData);
            expect(r.subject).toBe('New Temple Event: Kabbalat Shabbat');
            expect(r.html).toContain('Kabbalat Shabbat');
            expect(r.html).toContain('Main Sanctuary');
            expect(r.html).toContain('unsubscribe');
            expect(r.html).toContain('tok-1');
            expect(r.text).toContain('Unsubscribe');
        });

        test('event-updated renders subject with title', () => {
            const r = emailTemplateService.renderTemplate('event-updated', eventData);
            expect(r.subject).toBe('Event Updated: Kabbalat Shabbat');
            expect(r.html).toContain('unsubscribe');
        });

        test('event-canceled renders cancellation subject', () => {
            const r = emailTemplateService.renderTemplate('event-canceled', eventData);
            expect(r.subject).toBe('Event Canceled: Kabbalat Shabbat');
            expect(r.html).toContain('canceled');
            expect(r.html).toContain('unsubscribe');
        });

        test('event-reminder renders 24h subject and copy', () => {
            const r = emailTemplateService.renderTemplate('event-reminder', eventData);
            expect(r.subject).toContain('Reminder: Kabbalat Shabbat tomorrow at');
            expect(r.html).toContain('starts in 24 hours');
            expect(r.html).toContain('unsubscribe');
        });

        test('edge: missing optional fields (no zoom/location) render gracefully', () => {
            const r = emailTemplateService.renderTemplate('new-event', {
                title: 'Bare Event',
                date: new Date('2099-07-10T19:00:00Z')
            });
            expect(r.subject).toBe('New Temple Event: Bare Event');
            expect(r.html).not.toContain('Where:');
            expect(r.html).not.toContain('Join online');
        });

        test('security: hostile event fields are HTML-escaped in the email body (no stored XSS)', () => {
            const r = emailTemplateService.renderTemplate('new-event', {
                memberName: 'Ilya',
                title: '<script>alert(1)</script>',
                description: '<img src=x onerror=alert(2)>',
                location: '"><b>hax</b>',
                zoomUrl: 'javascript:alert(3)',
                date: new Date('2099-07-10T19:00:00Z'),
                calendarUrl: 'https://temple.example.com/calendar'
            });
            // Raw author markup must NOT survive into the HTML body.
            expect(r.html).not.toContain('<script>alert(1)</script>');
            expect(r.html).not.toContain('<img src=x onerror=alert(2)>');
            expect(r.html).not.toContain('<b>hax</b>');
            // Escaped entities are present instead.
            expect(r.html).toContain('&lt;script&gt;');
            // A javascript: zoom URL must be neutralised in the href.
            expect(r.html).not.toContain('href="javascript:alert(3)"');
        });

        test('security: event-reminder escapes hostile fields too', () => {
            const r = emailTemplateService.renderTemplate('event-reminder', {
                title: '<script>x</script>',
                description: '<svg onload=alert(1)>',
                date: new Date('2099-07-10T19:00:00Z')
            });
            expect(r.html).not.toContain('<script>x</script>');
            expect(r.html).not.toContain('<svg onload=alert(1)>');
            expect(r.html).toContain('&lt;script&gt;');
        });
    });

    describe('List-Unsubscribe headers (RFC 8058 one-click)', () => {
        const origEnv = { ...process.env };
        afterEach(() => { process.env = { ...origEnv }; });

        test('non-exempt member email carries List-Unsubscribe + one-click POST headers', () => {
            process.env.APP_BASE_URL = 'https://temple.example.com';
            const r = emailTemplateService.renderTemplate('announcement-notification', {
                bodyHtml: '<p>x</p>', bodyText: 'x', unsubscribeToken: 'tok123'
            });
            expect(r.headers).toBeDefined();
            expect(r.headers['List-Unsubscribe']).toBe('<https://temple.example.com/unsubscribe?token=tok123>');
            expect(r.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
        });

        test('exempt transactional email (password-reset) carries no unsubscribe headers', () => {
            const r = emailTemplateService.renderTemplate('password-reset', { name: 'Dana', resetLink: 'https://x/y' });
            expect(r.headers).toBeUndefined();
        });

        test('header URL matches the in-body unsubscribe link (single source of truth)', () => {
            process.env.APP_BASE_URL = 'https://temple.example.com';
            const r = emailTemplateService.renderTemplate('new-event', {
                title: 'X', date: new Date('2099-07-10T19:00:00Z'), unsubscribeToken: 'tok-1'
            });
            expect(r.headers['List-Unsubscribe']).toContain('tok-1');
            expect(r.html).toContain('tok-1');
        });
    });
});
