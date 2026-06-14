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
    });
});
