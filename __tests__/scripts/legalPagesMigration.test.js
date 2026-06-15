const fs = require('fs');
const path = require('path');

describe('legal pages seed migration', () => {
  test('seeds privacy, terms, and accessibility static pages', () => {
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'));

    const content = files
      .map((file) => fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
      .join('\n');

    // The three legal slugs must be seeded into static_pages so the public
    // /privacy, /terms, /accessibility routes resolve to a published page.
    const seedsStaticPages = /INSERT INTO static_pages/i.test(content);
    expect(seedsStaticPages).toBe(true);
    ['privacy', 'terms', 'accessibility'].forEach((slug) => {
      expect(content).toMatch(new RegExp(`'${slug}'`));
    });
  });
});
