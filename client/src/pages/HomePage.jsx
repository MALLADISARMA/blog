import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi.js';
import { sectionApi } from '../api/sectionApi.js';
import { Layout } from '../components/Layout.jsx';
import { SectionTree } from '../components/SectionTree.jsx';

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionId = searchParams.get('section') || '';
  const page = Number(searchParams.get('page')) || 1;
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setSearchInput(searchParams.get('search') || '');
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      blogApi.list({ sectionId, page, limit: 10, search: searchParams.get('search') || '' }),
      sectionApi.tree(),
    ])
      .then(([postData, sectionData]) => {
        if (cancelled) return;
        setPosts(postData.posts);
        setPagination(postData.pagination);
        setSections(sectionData.sections);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sectionId, page, searchParams]);

  function search(event) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set('search', searchInput.trim());
    else next.delete('search');
    next.delete('page');
    setSearchParams(next);
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    setSearchParams(next);
  }

  return (
    <Layout>
      <section className="hero">
        <p className="eyebrow">A personal journal</p>
        <h1>Ideas grow when<br />you give them room.</h1>
        <p>Notes on making, learning, and paying attention.</p>
      </section>
      <div className="content-grid">
        <section aria-labelledby="stories-heading">
          <div className="section-heading">
            <h2 id="stories-heading">{sectionId ? 'Selected stories' : 'Recent stories'}</h2>
            {sectionId && <Link to="/">Show all</Link>}
          </div>
          <form className="search-form" onSubmit={search} role="search">
            <label className="sr-only" htmlFor="post-search">Search published stories</label>
            <input id="post-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search stories…" />
            <button className="button" type="submit">Search</button>
          </form>
          {error && <p className="error" role="alert">{error}</p>}
          {loading ? <output className="muted">Loading stories…</output> : (
            <>
              {posts.length ? (
                <div className="post-list">
                  {posts.map((post) => (
                    <article className="post-card" key={post.id}>
                      <p className="eyebrow">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Story'}</p>
                      <h3><Link to={`/article/${post.slug}`}>{post.title}</Link></h3>
                      <p>{post.excerpt || post.content.slice(0, 180)}</p>
                      <Link className="text-link" to={`/article/${post.slug}`}>Read story →</Link>
                    </article>
                  ))}
                </div>
              ) : <p className="muted">No published stories match your search.</p>}
              {pagination?.totalPages > 1 && (
                <nav className="pagination" aria-label="Story pages">
                  <button className="button secondary" type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
                  <span>Page {pagination.page} of {pagination.totalPages}</span>
                  <button className="button secondary" type="button" disabled={page >= pagination.totalPages} onClick={() => goToPage(page + 1)}>Next</button>
                </nav>
              )}
            </>
          )}
        </section>
        <aside className="sidebar">
          <h2>Explore</h2>
          {sections.length ? <SectionTree sections={sections} /> : <p className="muted">Sections will appear here.</p>}
        </aside>
      </div>
    </Layout>
  );
}
