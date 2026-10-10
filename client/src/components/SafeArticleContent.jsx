import { useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';

const allowedImageUrl = /^\/uploads\/[\w-]+\.(?:png|jpe?g|gif|webp)$/i;

export function sanitizeArticleHtml(content) {
  return DOMPurify.sanitize(content || '', {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
      'h2', 'h3', 'blockquote', 'pre', 'code', 'img',
    ],
    ALLOWED_ATTR: ['src', 'alt', 'title'],
    ALLOWED_URI_REGEXP: allowedImageUrl,
  });
}

export function prepareArticleHtml(content) {
  const document = new DOMParser().parseFromString(sanitizeArticleHtml(content), 'text/html');
  const headings = [...document.body.querySelectorAll('h2, h3')].map((heading, index) => {
    const baseId = heading.textContent
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `section-${index + 1}`;
    heading.id = `${baseId}-${index + 1}`;
    return { id: heading.id, title: heading.textContent, level: Number(heading.tagName.slice(1)) };
  });
  return { html: document.body.innerHTML, headings };
}

export function SafeArticleContent({
  content,
  className = 'article-content',
  withHeadingIds = false,
  copyCode = false,
}) {
  const contentRef = useRef(null);
  const prepared = useMemo(
    () => (withHeadingIds ? prepareArticleHtml(content) : null),
    [content, withHeadingIds],
  );

  useEffect(() => {
    if (!copyCode || !contentRef.current) return undefined;
    const buttons = [...contentRef.current.querySelectorAll('pre')].map((block) => {
      const button = document.createElement('button');
      button.className = 'code-copy-button';
      button.type = 'button';
      button.textContent = 'Copy';
      const copy = async () => {
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable');
          await navigator.clipboard.writeText(block.querySelector('code')?.textContent || block.textContent);
          button.textContent = 'Copied';
        } catch {
          button.textContent = 'Copy unavailable';
        }
        window.setTimeout(() => { button.textContent = 'Copy'; }, 1600);
      };
      button.addEventListener('click', copy);
      block.append(button);
      return { button, copy };
    });
    return () => {
      for (const { button, copy } of buttons) {
        button.removeEventListener('click', copy);
        button.remove();
      }
    };
  }, [content, copyCode, withHeadingIds]);

  return (
    <div
      ref={contentRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: prepared?.html || sanitizeArticleHtml(content) }}
    />
  );
}
