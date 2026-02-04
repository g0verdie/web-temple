/**
 * __tests__/utils/sanitizeHtml.test.js
 * Tests for HTML sanitization utility
 */

const { sanitizeHtml, escapeHtml } = require('../../src/utils/sanitizeHtml');

describe('sanitizeHtml', () => {
  describe('Script Tag Removal', () => {
    it('should remove script tags', () => {
      const input = '<p>Safe</p><script>alert("XSS")</script>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('<script>');
      expect(output).not.toContain('alert');
      expect(output).toContain('<p>');
    });

    it('should remove script tags with attributes', () => {
      const input = '<script src="malicious.js"></script>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('<script');
      expect(output).not.toContain('malicious');
    });

    it('should remove nested script tags', () => {
      const input = '<div><script>var x = 1;</script></div>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('<script');
      expect(output).not.toContain('var x');
    });
  });

  describe('Event Handler Removal', () => {
    it('should remove onclick handlers', () => {
      const input = '<p onclick="alert(\'XSS\')">Click me</p>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onclick');
      expect(output).toContain('Click me');
    });

    it('should remove onerror handlers', () => {
      const input = '<img src="x" onerror="alert(\'XSS\')">';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onerror');
    });

    it('should remove onload handlers', () => {
      const input = '<body onload="alert(\'XSS\')"></body>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onload');
    });

    it('should remove multiple event handlers', () => {
      const input = '<div onclick="x" onmouseover="y" onload="z">Text</div>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onclick');
      expect(output).not.toContain('onmouseover');
      expect(output).not.toContain('onload');
    });
  });

  describe('Style Attribute Removal', () => {
    it('should remove style attributes', () => {
      const input = '<p style="color: red">Text</p>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('style=');
      expect(output).toContain('<p>');
    });

    it('should remove style with dangerous content', () => {
      const input = '<p style="background: url(\'javascript:alert(1)\')">Text</p>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('style');
      expect(output).not.toContain('javascript');
    });
  });

  describe('Allowed Tags', () => {
    it('should preserve allowed paragraph tags', () => {
      const input = '<p>Paragraph</p>';
      const output = sanitizeHtml(input);
      expect(output).toContain('<p>');
    });

    it('should preserve h2 and h3 tags', () => {
      const input = '<h2>Heading 2</h2><h3>Heading 3</h3>';
      const output = sanitizeHtml(input);
      expect(output).toContain('<h2>');
      expect(output).toContain('<h3>');
    });

    it('should preserve bold and italic tags', () => {
      const input = '<strong>Bold</strong> and <em>italic</em>';
      const output = sanitizeHtml(input);
      expect(output).toContain('<strong>');
      expect(output).toContain('<em>');
    });

    it('should preserve underline tags', () => {
      const input = '<u>Underlined</u>';
      const output = sanitizeHtml(input);
      expect(output).toContain('<u>');
    });

    it('should preserve list tags', () => {
      const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const output = sanitizeHtml(input);
      expect(output).toContain('<ul>');
      expect(output).toContain('<li>');
    });

    it('should preserve ordered list tags', () => {
      const input = '<ol><li>First</li><li>Second</li></ol>';
      const output = sanitizeHtml(input);
      expect(output).toContain('<ol>');
      expect(output).toContain('<li>');
    });
  });

  describe('Link Handling', () => {
    it('should preserve safe links', () => {
      const input = '<a href="https://example.com">Link</a>';
      const output = sanitizeHtml(input);
      expect(output).toContain('<a');
      expect(output).toContain('href=');
      expect(output).toContain('https://example.com');
    });

    it('should preserve relative links', () => {
      const input = '<a href="/about">About</a>';
      const output = sanitizeHtml(input);
      expect(output).toContain('href=');
      expect(output).toContain('/about');
    });

    it('should remove javascript protocol in links', () => {
      const input = '<a href="javascript:alert(\'XSS\')">Click</a>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('javascript:');
    });

    it('should remove data protocol in links', () => {
      const input = '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('data:');
    });
  });

  describe('Image Handling', () => {
    it('should preserve img tags with safe src and alt', () => {
      const input = '<img src="https://example.com/image.jpg" alt="Description">';
      const output = sanitizeHtml(input);
      expect(output).toContain('<img');
      expect(output).toContain('src=');
      expect(output).toContain('alt=');
    });

    it('should remove javascript protocol in img src', () => {
      const input = '<img src="javascript:alert(\'XSS\')" alt="test">';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('javascript:');
    });

    it('should remove data protocol in img src', () => {
      const input = '<img src="data:text/html,<script>alert(\'XSS\')</script>" alt="test">';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('data:');
    });
  });

  describe('Disallowed Tags', () => {
    it('should remove script tags', () => {
      const input = '<script>alert("XSS")</script>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('<script');
    });

    it('should remove iframe tags', () => {
      const input = '<iframe src="malicious.html"></iframe>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('<iframe');
    });

    it('should remove object tags', () => {
      const input = '<object data="malicious.swf"></object>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('<object');
    });

    it('should remove embed tags', () => {
      const input = '<embed src="malicious.swf">';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('<embed');
    });
  });

  describe('Data Attributes', () => {
    it('should remove data attributes', () => {
      const input = '<div data-evil="malicious">Content</div>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('data-evil');
    });

    it('should remove multiple data attributes', () => {
      const input = '<div data-x="1" data-y="2" data-z="3">Content</div>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('data-');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null input', () => {
      const output = sanitizeHtml(null);
      expect(output).toBe('');
    });

    it('should handle undefined input', () => {
      const output = sanitizeHtml(undefined);
      expect(output).toBe('');
    });

    it('should handle empty string', () => {
      const output = sanitizeHtml('');
      expect(output).toBe('');
    });

    it('should handle text-only input', () => {
      const input = 'Just plain text';
      const output = sanitizeHtml(input);
      expect(output).toBe('Just plain text');
    });

    it('should handle complex nested HTML', () => {
      const input = `
        <div>
          <h2>Title</h2>
          <p>Paragraph with <strong>bold</strong> and <em>italic</em></p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
          <p>More text with <a href="https://example.com">link</a></p>
        </div>
      `;
      const output = sanitizeHtml(input);
      expect(output).toContain('<h2>');
      expect(output).toContain('<strong>');
      expect(output).toContain('<em>');
      expect(output).toContain('<a');
      expect(output).not.toContain('<div>'); // div not in allowed tags
    });
  });

  describe('Real-world XSS Vectors', () => {
    it('should prevent img tag with onerror', () => {
      const input = '<img src=x onerror=alert("XSS")>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onerror');
    });

    it('should prevent svg with script', () => {
      const input = '<svg/onload=alert("XSS")>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onload');
      expect(output).not.toContain('alert');
    });

    it('should prevent event handler without quotes', () => {
      const input = '<p onclick=alert("XSS")>Text</p>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onclick');
    });
  });
});

describe('escapeHtml', () => {
  it('should escape ampersand', () => {
    expect(escapeHtml('A & B')).toContain('&amp;');
  });

  it('should escape less than', () => {
    expect(escapeHtml('A < B')).toContain('&lt;');
  });

  it('should escape greater than', () => {
    expect(escapeHtml('A > B')).toContain('&gt;');
  });

  it('should escape double quotes', () => {
    expect(escapeHtml('Say "Hello"')).toContain('&quot;');
  });

  it('should escape single quotes', () => {
    expect(escapeHtml("It's")).toContain('&#039;');
  });

  it('should escape all special characters', () => {
    const input = '&<>"\'';
    const output = escapeHtml(input);
    expect(output).toContain('&amp;');
    expect(output).toContain('&lt;');
    expect(output).toContain('&gt;');
    expect(output).toContain('&quot;');
    expect(output).toContain('&#039;');
  });
});
