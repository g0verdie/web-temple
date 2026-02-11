const emailTemplateService = require('../../src/services/emailTemplateService');

describe('emailTemplateService', () => {
    test('renders welcome template with unsubscribe link', () => {
        const rendered = emailTemplateService.renderTemplate('welcome', { name: 'Ilya' });

        expect(rendered.subject).toContain('Welcome');
        expect(rendered.html).toContain('unsubscribe');
        expect(rendered.text).toContain('Unsubscribe');
        expect(rendered.html).toContain('Ilya');
    });

    test('renders reset template with tokenized unsubscribe link', () => {
        const rendered = emailTemplateService.renderTemplate('reset', {
            resetUrl: 'https://example.com/reset',
            unsubscribeToken: 'token-123'
        });

        expect(rendered.html).toContain('reset');
        expect(rendered.text).toContain('reset');
        expect(rendered.html).toContain('token=token-123');
    });

    test('throws for unknown template', () => {
        expect(() => emailTemplateService.renderTemplate('unknown-template')).toThrow('Unknown email template');
    });
});
