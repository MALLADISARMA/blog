import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from './api.js';

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const emptyPost = { title: '', slug: '', excerpt: '', content: '', status: 'draft', sectionId: '' };
const emptySection = { name: '', slug: '', parentId: '' };

function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then((data) => setAdmin(data.admin))
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    admin,
    loading,
    async login(email, password) {
      const data = await api.login(email, password);
      setAdmin(data.admin);
    },
    async logout() {
      await api.logout();
      setAdmin(null);
    },
  }), [admin, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Header() {
  const { admin } = useAuth();
  return (
    <header className="site-header">
      <Link to="/" className="brand">Fieldnotes<span>.</span></Link>
      <nav>
        <Link to="/">Journal</Link>
        {admin ? <Link to="/admin">Dashboard</Link> : <Link to="/login">Admin</Link>}
      </nav>
    </header>
  );
}

function Layout({ children }) {
  return (
    <>
      <Header />
      <main className="page">{children}</main>
      <footer>Thoughts, stories, and things worth keeping.</footer>
    </>
  );
}

function SectionTree({ sections }) {
  if (!sections?.length) return null;
  return (
    <ul>
      {sections.map((section) => (
        <li key={section.id}>
          <Link to={`/?section=${encodeURIComponent(section.id)}`}>{section.name}</Link>
          <SectionTree sections={section.children} />
        </li>
      ))}
    </ul>
  );
}

function Home() {
  const location = useLocation();
  const section = new URLSearchParams(location.search).get('section');
  const [posts, setPosts] = useState([]);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    Promise.all([
      api.listPosts(section ? `?sectionId=${encodeURIComponent(section)}` : ''),
      api.sections(),
    ])
      .then(([postData, sectionData]) => {
        setPosts(postData.posts);
        setSections(sectionData.sections);
      })
      .catch((error_) => setError(error_.message));
  }, [section]);

  let postContent = null;
  if (posts.length) {
    postContent = (
      <div className="post-list">
        {posts.map((post) => (
          <article className="post-card" key={post.id}>
            <p className="eyebrow">
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Story'}
            </p>
            <h3><Link to={`/article/${post.slug}`}>{post.title}</Link></h3>
            <p>{post.excerpt || post.content.slice(0, 180)}</p>
            <Link className="text-link" to={`/article/${post.slug}`}>Read story →</Link>
          </article>
        ))}
      </div>
    );
  } else if (!error) {
    postContent = <p className="muted">No published stories yet.</p>;
  }

  return (
    <Layout>
      <section className="hero">
        <p className="eyebrow">A personal journal</p>
        <h1>Ideas grow when<br />you give them room.</h1>
        <p>Notes on making, learning, and paying attention.</p>
      </section>
      <div className="content-grid">
        <section>
          <div className="section-heading">
            <h2>{section ? 'Selected stories' : 'Recent stories'}</h2>
            {section && <Link to="/">Show all</Link>}
          </div>
          {error && <p className="error">{error}</p>}
          {postContent}
        </section>
        <aside className="sidebar">
          <h2>Explore</h2>
          {sections.length ? <SectionTree sections={sections} /> : <p className="muted">Sections will appear here.</p>}
        </aside>
      </div>
    </Layout>
  );
}

function Article() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPost(null);
    setError('');
    api.getPost(slug).then((data) => setPost(data.post)).catch((error_) => setError(error_.message));
  }, [slug]);

  let articleContent;
  if (error) {
    articleContent = <p className="error">{error}</p>;
  } else if (!post) {
    articleContent = <p className="muted">Loading story…</p>;
  } else {
    articleContent = (
      <article className="article">
        <Link className="text-link" to="/">← All stories</Link>
        <p className="eyebrow">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}</p>
        <h1>{post.title}</h1>
        {post.excerpt && <p className="article-excerpt">{post.excerpt}</p>}
        <div className="article-content">{post.content}</div>
      </article>
    );
  }

  return <Layout>{articleContent}</Layout>;
}

function Login() {
  const { admin, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (loading) return <Layout><p>Loading…</p></Layout>;
  if (admin) return <Navigate to="/admin" replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/admin');
    } catch (error_) {
      setError(error_.message);
    }
  }

  return (
    <Layout>
      <section className="form-panel narrow">
        <p className="eyebrow">Private area</p>
        <h1>Administrator sign in</h1>
        <form onSubmit={submit}>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error && <p className="error">{error}</p>}
          <button className="button" type="submit">Sign in</button>
        </form>
      </section>
    </Layout>
  );
}

function ProtectedAdmin() {
  const { admin, loading } = useAuth();
  if (loading) return <Layout><p>Loading…</p></Layout>;
  return admin ? <Admin /> : <Navigate to="/login" replace />;
}

function Admin() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [sections, setSections] = useState([]);
  const [post, setPost] = useState(emptyPost);
  const [section, setSection] = useState(emptySection);
  const [tab, setTab] = useState('posts');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    const [postData, sectionData] = await Promise.all([api.adminPosts(), api.adminSections()]);
    setPosts(postData.posts);
    setSections(sectionData.sections);
  }

  useEffect(() => {
    refresh().catch((error_) => setError(error_.message));
  }, []);

  async function savePost(event) {
    event.preventDefault();
    setNotice('');
    setError('');
    try {
      await api.savePost({ ...post, sectionId: post.sectionId || null });
      setPost(emptyPost);
      await refresh();
      setNotice('Story saved.');
    } catch (error_) {
      setError(error_.message);
    }
  }

  async function deletePost(id) {
    if (!window.confirm('Delete this story?')) return;
    try {
      await api.deletePost(id);
      await refresh();
      setNotice('Story deleted.');
    } catch (error_) {
      setError(error_.message);
    }
  }

  async function saveSection(event) {
    event.preventDefault();
    setNotice('');
    setError('');
    try {
      await api.saveSection({ ...section, parentId: section.parentId || null });
      setSection(emptySection);
      await refresh();
      setNotice('Section saved.');
    } catch (error_) {
      setError(error_.message);
    }
  }

  async function deleteSection(id) {
    if (!window.confirm('Delete this section?')) return;
    try {
      await api.deleteSection(id);
      await refresh();
      setNotice('Section deleted.');
    } catch (error_) {
      setError(error_.message);
    }
  }

  async function signOut() {
    try {
      await logout();
      navigate('/');
    } catch (error_) {
      setError(error_.message);
    }
  }

  function editPost(item) {
    setPost({ ...item, sectionId: item.sectionId || '' });
    setTab('posts');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function editSection(item) {
    setSection({ ...item, parentId: item.parentId || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <Layout>
      <div className="admin-heading">
        <div><p className="eyebrow">Signed in as {admin.email}</p><h1>Dashboard</h1></div>
        <button className="button secondary" type="button" onClick={signOut}>Sign out</button>
      </div>
      <div className="tabs">
        <button className={tab === 'posts' ? 'active' : ''} type="button" onClick={() => setTab('posts')}>Stories</button>
        <button className={tab === 'sections' ? 'active' : ''} type="button" onClick={() => setTab('sections')}>Sections</button>
      </div>
      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {tab === 'posts' ? (
        <div className="admin-grid">
          <section className="form-panel">
            <h2>{post.id ? 'Edit story' : 'Write a story'}</h2>
            <form onSubmit={savePost}>
              <label htmlFor="post-title">Title</label>
              <input id="post-title" value={post.title} onChange={(event) => setPost({ ...post, title: event.target.value })} required maxLength="200" />
              <label htmlFor="post-slug">Slug <span className="muted">(optional; generated from title)</span></label>
              <input id="post-slug" value={post.slug} onChange={(event) => setPost({ ...post, slug: event.target.value })} maxLength="120" />
              <label htmlFor="post-excerpt">Excerpt</label>
              <textarea id="post-excerpt" rows="3" value={post.excerpt} onChange={(event) => setPost({ ...post, excerpt: event.target.value })} maxLength="500" />
              <label htmlFor="post-content">Content</label>
              <textarea id="post-content" rows="12" value={post.content} onChange={(event) => setPost({ ...post, content: event.target.value })} required />
              <label htmlFor="post-section">Section</label>
              <select id="post-section" value={post.sectionId} onChange={(event) => setPost({ ...post, sectionId: event.target.value })}>
                <option value="">No section</option>
                {sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <label htmlFor="post-status">Status</label>
              <select id="post-status" value={post.status} onChange={(event) => setPost({ ...post, status: event.target.value })}>
                <option value="draft">Draft</option><option value="published">Published</option>
              </select>
              <div className="button-row">
                <button className="button" type="submit">{post.id ? 'Save changes' : 'Save story'}</button>
                {post.id && <button type="button" className="button secondary" onClick={() => setPost(emptyPost)}>Cancel</button>}
              </div>
            </form>
          </section>
          <section>
            <h2>All stories <span className="count">{posts.length}</span></h2>
            {posts.length ? (
              <div className="admin-list">
                {posts.map((item) => (
                  <article key={item.id} className="admin-item">
                    <div><span className={`status ${item.status}`}>{item.status}</span><h3>{item.title}</h3><small>/{item.slug}</small></div>
                    <div className="button-row">
                      <button className="button secondary small" type="button" onClick={() => editPost(item)}>Edit</button>
                      <button className="button danger small" type="button" onClick={() => deletePost(item.id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="muted">No stories yet.</p>}
          </section>
        </div>
      ) : (
        <div className="admin-grid sections-grid">
          <section className="form-panel">
            <h2>{section.id ? 'Edit section' : 'Add a section'}</h2>
            <form onSubmit={saveSection}>
              <label htmlFor="section-name">Name</label>
              <input id="section-name" value={section.name} onChange={(event) => setSection({ ...section, name: event.target.value })} required maxLength="100" />
              <label htmlFor="section-slug">Slug <span className="muted">(optional)</span></label>
              <input id="section-slug" value={section.slug} onChange={(event) => setSection({ ...section, slug: event.target.value })} maxLength="120" />
              <label htmlFor="section-parent">Parent section</label>
              <select id="section-parent" value={section.parentId} onChange={(event) => setSection({ ...section, parentId: event.target.value })}>
                <option value="">Top-level section</option>
                {sections.filter((item) => item.id !== section.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="button-row">
                <button className="button" type="submit">{section.id ? 'Save section' : 'Add section'}</button>
                {section.id && <button type="button" className="button secondary" onClick={() => setSection(emptySection)}>Cancel</button>}
              </div>
            </form>
          </section>
          <section>
            <h2>Manage sections</h2>
            {sections.length ? (
              <div className="admin-list">
                {sections.map((item) => (
                  <article key={item.id} className="admin-item">
                    <div><h3>{item.name}</h3><small>/{item.slug}{item.parentId ? ' · nested' : ''}</small></div>
                    <div className="button-row">
                      <button className="button secondary small" type="button" onClick={() => editSection(item)}>Edit</button>
                      <button className="button danger small" type="button" onClick={() => deleteSection(item.id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="muted">No sections created yet.</p>}
          </section>
        </div>
      )}
    </Layout>
  );
}

function NotFound() {
  return (
    <Layout>
      <section className="form-panel">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <Link className="text-link" to="/">Return home →</Link>
      </section>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/article/:slug" element={<Article />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<ProtectedAdmin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
