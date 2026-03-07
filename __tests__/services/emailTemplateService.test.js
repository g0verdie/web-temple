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
});
