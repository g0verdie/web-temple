const fs = require('fs');
const path = require('path');
const { sanitizeHtml } = require('../../src/utils/sanitizeHtml');

describe('about page content seed migration', () => {
  const migrationPath = path.join(__dirname, '../../migrations/027_seed_about_page_content.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const htmlMatch = sql.match(/\$html\$([\s\S]*?)\$html\$/);
  const html = htmlMatch ? htmlMatch[1] : null;

  test('embeds a dollar-quoted HTML content block', () => {
    expect(html).toBeTruthy();
  });

  test('content is the sanitizer fixed point (admin-editor save round-trips it unchanged)', () => {
    expect(sanitizeHtml(html)).toBe(html);
  });

  test('content carries the letter\'s load-bearing facts', () => {
    [
      'Nancy Tunick',
      'Shoals',
      'Florence',
      'Friday',
      '7:00',
      'Saturday',
      '9:30',
      'Torah',
      'info@florencetemple.org'
    ].forEach((fact) => {
      expect(html).toContain(fact);
    });
  });

  test('includes the temple building photo with descriptive alt text', () => {
    const img = html.match(/<img\s[^>]*\/?>/);
    expect(img).toBeTruthy();
    expect(img[0]).toContain('src="/images/temple-building.jpg"');
    const alt = img[0].match(/alt="([^"]*)"/);
    expect(alt).toBeTruthy();
    expect(alt[1].trim()).not.toBe('');
  });

  test('contains no sanitizer-disallowed content', () => {
    expect(html).not.toMatch(/<br\b/i);
    expect(html).not.toMatch(/<blockquote\b/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/style\s*=/i);
  });

  test('updates only the untouched 001 placeholder row and never flips publish state', () => {
    // The guard keeps a hand-edited production row from being clobbered.
    expect(sql).toMatch(/WHERE slug = 'about'\s+AND content LIKE '%vibrant and inclusive Jewish community%'/);
    // Publishing stays owner-gated in the admin UI; the migration must not set it.
    expect(sql).not.toMatch(/published\s*=/i);
  });
});
