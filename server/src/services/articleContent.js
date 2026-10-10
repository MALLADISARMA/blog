import sanitizeHtml from 'sanitize-html';

const allowedImagePath = /^\/uploads\/[A-Za-z0-9_-]+\.(?:png|jpe?g|gif|webp)$/i;

export function sanitizeArticleContent(content) {
  return sanitizeHtml(content, {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
      'h2', 'h3', 'blockquote', 'pre', 'code', 'img',
    ],
    allowedAttributes: {
      img: ['src', 'alt', 'title'],
    },
    allowedSchemes: [],
    allowProtocolRelative: false,
    transformTags: {
      span(tagName, attribs) {
        const isBold = /(?:^|;)\s*font-weight\s*:\s*(?:bold|bolder|[6-9]00|1000)\b/i
          .test(attribs.style || '');
        return isBold
          ? { tagName: 'strong', attribs: {} }
          : { tagName, attribs: {} };
      },
    },
    exclusiveFilter(frame) {
      return frame.tag === 'img' && !allowedImagePath.test(frame.attribs.src || '');
    },
  });
}
