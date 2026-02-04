/**
 * sanitizeHtml.js
 * Sanitizes user-provided HTML to prevent XSS attacks while preserving rich text formatting
 */

const allowedTags = ['p', 'h2', 'h3', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'img', 'br'];
const allowedAttributes = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'width', 'height'],
};

/**
 * Sanitizes HTML by removing dangerous tags and attributes
 * @param {string} html - Raw HTML input from editor
 * @returns {string} - Sanitized HTML safe for storage and display
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let sanitized = html;

  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*[^\s>]*/gi, '');
  
  // Remove style attributes (prevent CSS-based attacks)
  sanitized = sanitized.replace(/\s+style\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove data attributes
  sanitized = sanitized.replace(/\s+data-[a-z0-9-]*\s*=\s*["'][^"']*["']/gi, '');
  
  // Sanitize URLs in href and src attributes
  sanitized = sanitizeUrls(sanitized);
  
  // Remove any tags not in allowedTags
  sanitized = removeUnallowedTags(sanitized);
  
  // Clean up empty or malformed tags
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Sanitizes URLs in href and src attributes
 * @param {string} html - HTML content
 * @returns {string} - HTML with safe URLs
 */
function sanitizeUrls(html) {
  let result = html;

  // Sanitize href attributes
  result = result.replace(/href\s*=\s*["']([^"']*)["']/gi, (match, url) => {
    if (isSafeUrl(url)) {
      return `href="${url}"`;
    }
    return 'href="#"';
  });

  // Sanitize src attributes
  result = result.replace(/src\s*=\s*["']([^"']*)["']/gi, (match, url) => {
    if (isSafeUrl(url)) {
      return `src="${url}"`;
    }
    return '';
  });

  return result;
}

/**
 * Removes attributes that are not in the allowed list for each tag
 * @param {string} html - HTML with potentially dangerous attributes
 * @returns {string} - HTML with only allowed attributes
 */
function removeUnallowedAttributes(html) {
  let result = html;

  // Remove any remaining onclick, onerror, onload, style, data attributes
  // These should have been caught by the sanitizeHtml function
  result = result.replace(/\s+on[a-z]+\s*=\s*["'][^"']*["']/gi, '');
  result = result.replace(/\s+on[a-z]+\s*=\s*[^\s>]*/gi, '');
  result = result.replace(/\s+style\s*=\s*["'][^"']*["']/gi, '');
  result = result.replace(/\s+data-[a-z0-9-]*\s*=\s*["'][^"']*["']/gi, '');

  return result;
}

/**
 * Removes tags that are not in the allowedTags list
 * @param {string} html - HTML with potentially dangerous tags
 * @returns {string} - HTML with only allowed tags
 */
function removeUnallowedTags(html) {
  let result = html;

  // Create a comprehensive regex that captures opening and closing tags
  // We'll use a different approach: only remove specific dangerous tags
  
  // Remove script tags and content
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove iframe tags
  result = result.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  
  // Remove object and embed tags
  result = result.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  result = result.replace(/<embed\b[^<]*>/gi, '');
  
  // Remove style tags
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove any other tags not in allowedTags list
  const allowedTagsPattern = allowedTags.join('|');
  const dangerousTagRegex = new RegExp(`</?(?!(?:${allowedTagsPattern})(?:\\s|>))[a-zA-Z][^>]*>`, 'gi');
  result = result.replace(dangerousTagRegex, '');
  
  return result;
}

/**
 * Validates that a URL is safe (not javascript: or data: protocol)
 * @param {string} url - URL to validate
 * @returns {boolean} - True if URL is safe
 */
function isSafeUrl(url) {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase().trim();
  
  // Block javascript: and data: protocols
  if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:')) {
    return false;
  }
  
  // Allow relative URLs and http(s) URLs
  if (lowerUrl.startsWith('/') || lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
    return true;
  }
  
  return false;
}

/**
 * Escapes HTML special characters to prevent XSS when displaying content
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

module.exports = {
  sanitizeHtml,
  escapeHtml,
  allowedTags,
  allowedAttributes,
};
