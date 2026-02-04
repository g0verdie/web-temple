const sanitizeHtmlLib = require('sanitize-html');

const DEFAULT_ALLOWED_TAGS = [
  'p',
  'h2',
  'h3',
  'strong',
  'em',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'img'
];

const DEFAULT_ALLOWED_ATTRIBUTES = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title']
};

function sanitizeHtml(input) {
  if (!input) return '';

  return sanitizeHtmlLib(input, {
    allowedTags: DEFAULT_ALLOWED_TAGS,
    allowedAttributes: DEFAULT_ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'relative'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    allowedClasses: {},
    allowedStyles: {},
    nonTextTags: ['script', 'style', 'textarea', 'noscript'],
    parser: {
      lowerCaseTags: true
    },
    transformTags: {
      'a': sanitizeHtmlLib.simpleTransform('a', {
        rel: 'noopener noreferrer'
      }, true)
    }
  })
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sdata-[\w-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  sanitizeHtml,
  escapeHtml
};
