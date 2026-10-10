import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi.js';
import { sectionApi } from '../api/sectionApi.js';
import { Layout } from '../components/Layout.jsx';
import { RichTextEditor } from '../components/RichTextEditor.jsx';
import { SafeArticleContent } from '../components/SafeArticleContent.jsx';

const blankPost = { title: '', slug: '', excerpt: '', content: '', status: 'draft', sectionId: '', sections: [] };

function decorateSections(sections = []) {
  return sections.map((section) => ({
    ...section,
    key: section.id ? `saved-${section.id}` : `new-${crypto.randomUUID()}`,
    children: decorateSections(section.children || []),
  }));
}

function cleanSections(sections) {
  return sections.map(({ id, title, content, children }) => ({
    ...(id ? { id } : {}),
    title,
    content,
    children: cleanSections(children || []),
  }));
}

function containsBlankSectionTitle(sections) {
  return sections.some((section) => (
    !section.title.trim() || containsBlankSectionTitle(section.children || [])
  ));
}

function hasReadableContent(content) {
  if (/<img\b/i.test(content)) return true;
  const text = new DOMParser().parseFromString(content, 'text/html').body.textContent || '';
  return text.replaceAll('\u00a0', ' ').trim().length > 0;
}

function removeSectionTree(sections, key) {
  return sections
    .filter((section) => section.key !== key)
    .map((section) => ({ ...section, children: removeSectionTree(section.children || [], key) }));
}

function moveSectionTree(sections, key, direction) {
  const index = sections.findIndex((section) => section.key === key);
  if (index >= 0) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return sections;
    const moved = [...sections];
    [moved[index], moved[target]] = [moved[target], moved[index]];
    return moved;
  }
  return sections.map((section) => ({
    ...section,
    children: moveSectionTree(section.children || [], key, direction),
  }));
}

function ContentSectionNode({ section, index, siblingCount, depth, onChange, onDelete, onMove }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <article className="content-section-node" style={{ '--section-depth': depth }}>
      <div className="content-section-heading">
        <button
          className={`content-section-chevron${expanded ? ' expanded' : ''}`}
          type="button"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${section.title || 'untitled section'}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          ›
        </button>
        <span className="content-section-number">{index + 1}</span>
        <input
          aria-label="Section title"
          value={section.title}
          onChange={(event) => onChange({ ...section, title: event.target.value })}
          placeholder="Section title"
          maxLength="200"
        />
        <div className="content-section-actions">
          <button className="icon-button" type="button" aria-label="Move section up" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
          <button className="icon-button" type="button" aria-label="Move section down" disabled={index === siblingCount - 1} onClick={() => onMove(1)}>↓</button>
          <button className="icon-button remove-section" type="button" aria-label={`Delete ${section.title || 'section'}`} onClick={onDelete}>×</button>
        </div>
      </div>
      {expanded && (
        <div className="content-section-body">
          <RichTextEditor
            key={section.key}
            content={section.content}
            onChange={(content) => onChange({ ...section, content })}
            onUploadImage={blogApi.uploadImage}
          />
          <button
            className="add-subsection-button"
            type="button"
            onClick={() => onChange({
              ...section,
              children: [...(section.children || []), {
                key: `new-${crypto.randomUUID()}`,
                title: '',
                content: '',
                children: [],
              }],
            })}
          >
            <span aria-hidden="true">+</span> Add subsection
          </button>
          {section.children?.length > 0 && (
            <div className="nested-content-sections">
              {section.children.map((child, childIndex) => (
                <ContentSectionNode
                  key={child.key}
                  section={child}
                  index={childIndex}
                  siblingCount={section.children.length}
                  depth={depth + 1}
                  onChange={(updated) => onChange({
                    ...section,
                    children: section.children.map((item) => item.key === child.key ? updated : item),
                  })}
                  onDelete={() => onChange({
                    ...section,
                    children: section.children.filter((item) => item.key !== child.key),
                  })}
                  onMove={(direction) => onChange({
                    ...section,
                    children: moveSectionTree(section.children, child.key, direction),
                  })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function BlogSectionBuilder({ sections, onChange }) {
  return (
    <section className="blog-section-builder" aria-labelledby="section-builder-heading">
      <div className="section-builder-header">
        <div>
          <p className="eyebrow">Build the story structure</p>
          <h2 id="section-builder-heading">Sections</h2>
          <p className="muted">Add chapters and nest subsections inside this blog. Each section has its own rich-text content.</p>
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={() => onChange([...sections, {
            key: `new-${crypto.randomUUID()}`,
            title: '',
            content: '',
            children: [],
          }])}
        >
          <span aria-hidden="true">+</span> Add section
        </button>
      </div>
      {sections.length ? (
        <div className="content-section-list">
          {sections.map((section, index) => (
            <ContentSectionNode
              key={section.key}
              section={section}
              index={index}
              siblingCount={sections.length}
              depth={0}
              onChange={(updated) => onChange(sections.map((item) => item.key === section.key ? updated : item))}
              onDelete={() => onChange(removeSectionTree(sections, section.key))}
              onMove={(direction) => onChange(moveSectionTree(sections, section.key, direction))}
            />
          ))}
        </div>
      ) : <p className="empty-section-builder">Your blog has no sections yet. Add a section to start building its outline.</p>}
    </section>
  );
}

function PreviewSections({ sections }) {
  if (!sections.length) return null;
  return (
    <div className="preview-content-sections">
      {sections.map((section) => (
        <details key={section.key} open>
          <summary>{section.title || 'Untitled section'}</summary>
          <SafeArticleContent content={section.content || ''} />
          <PreviewSections sections={section.children || []} />
        </details>
      ))}
    </div>
  );
}

export default function BlogEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(blankPost);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [sectionData, postData] = await Promise.all([
          sectionApi.adminList(),
          id ? blogApi.adminGet(id) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setSections(sectionData.sections);
        if (id) {
          setPost({
            ...postData.post,
            sectionId: postData.post.sectionId || '',
            sections: decorateSections(postData.post.sections || []),
          });
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load().catch((loadError) => {
      if (!cancelled) setError(loadError.message);
    });
    return () => { cancelled = true; };
  }, [id]);

  async function save(status) {
    setError('');
    if (!post.title.trim() || !hasReadableContent(post.content)) {
      setError('Title and content are required.');
      return;
    }
    if (containsBlankSectionTitle(post.sections)) {
      setError('Every section needs a title. Add a title or delete the empty section.');
      return;
    }
    if (post.content.length > 100000) {
      setError('Content must be 100,000 characters or fewer.');
      return;
    }
    setSubmitting(true);
    try {
      await blogApi.save({
        ...post,
        status,
        sectionId: post.sectionId || null,
        sections: cleanSections(post.sections),
      });
      navigate('/admin', { replace: true, state: { notice: status === 'published' ? 'Story published.' : 'Draft saved.' } });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Layout><output>Loading editor…</output></Layout>;
  if (preview) {
    return (
      <Layout>
        <div className="editor-toolbar">
          <button className="button secondary" type="button" onClick={() => setPreview(false)}>Back to editor</button>
          <span className="status draft">Preview</span>
        </div>
        <article className="article editor-preview">
          <p className="eyebrow">Unpublished preview</p>
          <h1>{post.title || 'Untitled story'}</h1>
          {post.excerpt && <p className="article-excerpt">{post.excerpt}</p>}
          <SafeArticleContent content={post.content || '<p>Your article preview will appear here.</p>'} />
          <PreviewSections sections={post.sections} />
        </article>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="admin-heading">
        <div><p className="eyebrow">One complete blog</p><h1>{post.id ? 'Edit blog' : 'Create blog'}</h1></div>
        <Link className="button secondary" to="/admin">Back to dashboard</Link>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="form-panel editor-panel">
        <form onSubmit={(event) => { event.preventDefault(); void save('draft'); }}>
          <label htmlFor="editor-title"><span>Title</span>
            <input id="editor-title" value={post.title} onChange={(event) => setPost({ ...post, title: event.target.value })} required maxLength="200" />
          </label>
          <label htmlFor="editor-slug"><span>Slug <span className="muted">(optional; generated from title)</span></span>
            <input id="editor-slug" value={post.slug} onChange={(event) => setPost({ ...post, slug: event.target.value })} maxLength="120" />
          </label>
          <label htmlFor="editor-excerpt"><span>Excerpt</span>
            <textarea id="editor-excerpt" rows="3" value={post.excerpt} onChange={(event) => setPost({ ...post, excerpt: event.target.value })} maxLength="500" />
          </label>
          <p className="blog-intro-hint">Use the excerpt as the short introduction visitors see on the blog card.</p>
          <div className="editor-field">
            <span className="field-label">Content</span>
            <RichTextEditor
              key={post.id || 'new-post'}
              content={post.content}
              onChange={(content) => setPost((current) => ({ ...current, content }))}
              onUploadImage={blogApi.uploadImage}
            />
          </div>
          <BlogSectionBuilder
            sections={post.sections}
            onChange={(sections) => setPost((current) => ({ ...current, sections }))}
          />
          <label htmlFor="editor-section"><span>Legacy topic tag <span className="muted">(optional)</span></span>
            <select id="editor-section" value={post.sectionId} onChange={(event) => setPost({ ...post, sectionId: event.target.value })}>
              <option value="">No section</option>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </select>
          </label>
          <div className="button-row editor-actions">
            <button className="button" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save draft'}</button>
            <button className="button" type="button" disabled={submitting} onClick={() => { void save('published'); }}>{submitting ? 'Saving…' : 'Publish'}</button>
            <button className="button secondary" type="button" onClick={() => setPreview(true)}>Preview</button>
            <Link className="button secondary" to="/admin">Cancel</Link>
          </div>
        </form>
      </section>
    </Layout>
  );
}
