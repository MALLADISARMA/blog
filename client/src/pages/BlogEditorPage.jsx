import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi.js';
import { sectionApi } from '../api/sectionApi.js';
import { Layout } from '../components/Layout.jsx';

const blankPost = { title: '', slug: '', excerpt: '', content: '', status: 'draft', sectionId: '' };

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
          id ? blogApi.adminList() : Promise.resolve({ posts: [] }),
        ]);
        if (cancelled) return;
        setSections(sectionData.sections);
        if (id) {
          const found = postData.posts.find((item) => String(item.id) === id);
          if (!found) throw new Error('Story not found');
          setPost({ ...found, sectionId: found.sectionId || '' });
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
    if (!post.title.trim() || !post.content.trim()) {
      setError('Title and content are required.');
      return;
    }
    setSubmitting(true);
    try {
      await blogApi.save({ ...post, status, sectionId: post.sectionId || null });
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
          <div className="article-content">{post.content || 'Your article preview will appear here.'}</div>
        </article>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="admin-heading">
        <div><p className="eyebrow">Admin workspace</p><h1>{post.id ? 'Edit story' : 'Write a story'}</h1></div>
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
          <label htmlFor="editor-content"><span>Content</span>
            <textarea id="editor-content" rows="16" value={post.content} onChange={(event) => setPost({ ...post, content: event.target.value })} required maxLength="100000" />
          </label>
          <label htmlFor="editor-section"><span>Section</span>
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
