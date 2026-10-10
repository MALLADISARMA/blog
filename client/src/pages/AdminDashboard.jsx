import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { blogApi } from '../api/blogApi.js';
import { sectionApi } from '../api/sectionApi.js';
import { Layout } from '../components/Layout.jsx';
import { useAuth } from '../hooks/useAuth.js';

export default function AdminDashboard() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [sections, setSections] = useState([]);
  const [search, setSearch] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ search: '', sectionId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [postData, sectionData] = await Promise.all([
        blogApi.adminList(appliedFilters),
        sectionApi.adminList(),
      ]);
      setPosts(postData.posts);
      setSections(sectionData.sections);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (location.state?.notice) {
      setNotice(location.state.notice);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  async function removePost(post) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    try {
      await blogApi.remove(post.id);
      setNotice('Story deleted.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function togglePublished(post) {
    try {
      if (post.status === 'published') await blogApi.unpublish(post.id);
      else await blogApi.publish(post.id);
      setNotice(post.status === 'published' ? 'Story unpublished.' : 'Story published.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function signOut() {
    try {
      await logout();
      navigate('/');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function applyFilters(event) {
    event.preventDefault();
    setAppliedFilters({ search: search.trim(), sectionId });
  }

  let postList;
  if (loading) {
    postList = <output className="muted">Loading stories…</output>;
  } else if (posts.length) {
    postList = (
      <div className="admin-list">
        {posts.map((post) => (
          <article key={post.id} className="admin-item">
            <div>
              <span className={`status ${post.status}`}>{post.status}</span>
              <h3>{post.title}</h3>
              <small>/{post.slug}</small>
            </div>
            <div className="button-row admin-item-actions">
              <Link className="button secondary small" to={`/admin/editor/${post.id}`}>Edit</Link>
              <button className="button secondary small" type="button" onClick={() => setPreview(post)}>Preview</button>
              <button className="button secondary small" type="button" onClick={() => togglePublished(post)}>
                {post.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
              <button className="button danger small" type="button" onClick={() => removePost(post)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    );
  } else if (!error) {
    postList = <p className="muted">No stories match these filters.</p>;
  }

  return (
    <Layout>
      <div className="admin-heading">
        <div><p className="eyebrow">Signed in as {admin.email}</p><h1>Dashboard</h1></div>
        <button className="button secondary" type="button" onClick={signOut}>Sign out</button>
      </div>
      <div className="admin-actions">
        <Link className="button" to="/admin/editor">Write a story</Link>
        <Link className="button secondary" to="/admin/sections">Manage sections</Link>
      </div>
      {notice && <output className="success">{notice}</output>}
      {error && <p className="error" role="alert">{error}</p>}
      <form className="admin-filters" onSubmit={applyFilters}>
        <label htmlFor="admin-search"><span>Search title and content</span>
          <input id="admin-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label htmlFor="admin-section"><span>Section</span>
          <select id="admin-section" value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
            <option value="">All sections</option>
            {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
          </select>
        </label>
        <button className="button" type="submit">Filter</button>
      </form>
      <section aria-labelledby="admin-posts-heading">
        <h2 id="admin-posts-heading">All stories <span className="count">{posts.length}</span></h2>
        {postList}
      </section>
      {preview && (
        <dialog open className="preview-overlay" aria-modal="true" aria-labelledby="preview-title">
          <section className="preview-panel">
            <button className="button secondary small preview-close" type="button" onClick={() => setPreview(null)}>Close preview</button>
            <p className="eyebrow">{preview.status} preview</p>
            <h2 id="preview-title">{preview.title}</h2>
            {preview.excerpt && <p className="article-excerpt">{preview.excerpt}</p>}
            <div className="article-content">{preview.content}</div>
          </section>
        </dialog>
      )}
    </Layout>
  );
}
