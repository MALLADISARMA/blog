import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi.js';
import { Layout } from '../components/Layout.jsx';

const RECENT_SEARCHES_KEY = 'fieldnotes.recent-searches';

function readRecentSearches() {
  try {
    const items = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    return Array.isArray(items) ? items.filter((item) => typeof item === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

function getPostSummary(post) {
  if (post.excerpt) return post.excerpt;
  return new DOMParser().parseFromString(post.content, 'text/html').body.textContent.slice(0, 180);
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const sectionId = searchParams.get('section') || '';
  const page = Number(searchParams.get('page')) || 1;
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState(readRecentSearches);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionError, setSuggestionError] = useState('');
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  useEffect(() => {
    setSearchInput(searchParams.get('search') || '');
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    blogApi.list({ sectionId, page, limit: 10, search: searchParams.get('search') || '' })
      .then((postData) => {
        if (cancelled) return;
        setPosts(postData.posts);
        setPagination(postData.pagination);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sectionId, page, searchParams]);

  useEffect(() => {
    const query = searchInput.trim();
    setActiveSuggestion(-1);
    setSuggestionError('');
    if (!searchFocused || !query) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const articleData = await blogApi.list({ search: query, limit: 5 });
        if (cancelled) return;
        const matches = articleData.posts.flatMap((post) => {
          const blogMatch = {
            id: `article-${post.id}`,
            kind: 'blog',
            title: post.title,
            path: 'Complete blog',
            slug: post.slug,
          };
          const sectionMatches = (post.sectionMatches || []).map((section) => ({
            id: `section-${post.id}-${section.id}`,
            kind: 'section',
            title: section.title,
            path: `${post.title} → ${section.path}`,
            slug: post.slug,
            sectionId: section.id,
          }));
          return [blogMatch, ...sectionMatches];
        });
        setSuggestions(matches.slice(0, 8));
      } catch (requestError) {
        if (!cancelled) {
          setSuggestions([]);
          setSuggestionError(requestError.message);
        }
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchInput, searchFocused]);

  function saveRecentSearch(value) {
    const normalized = value.trim();
    if (!normalized) return;
    const next = [normalized, ...recentSearches.filter((item) => item !== normalized)].slice(0, 5);
    setRecentSearches(next);
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // Search still works when browser storage is unavailable.
    }
  }

  function search(event) {
    event.preventDefault();
    saveRecentSearch(searchInput);
    setSearchFocused(false);
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set('search', searchInput.trim());
    else next.delete('search');
    next.delete('page');
    setSearchParams(next);
  }

  function selectSuggestion(suggestion) {
    setSearchFocused(false);
    navigate(suggestion.sectionId
      ? `/article/${suggestion.slug}/section/${suggestion.sectionId}`
      : `/article/${suggestion.slug}`);
  }

  function onSearchKeyDown(event) {
    if (event.key === 'Escape') {
      setSearchFocused(false);
      setActiveSuggestion(-1);
    } else if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    }
  }

  function clearRecentSearches() {
    setRecentSearches([]);
    try {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // No action is needed when browser storage is unavailable.
    }
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    setSearchParams(next);
  }

  return (
    <Layout>
      <section className="hero knowledge-hero">
        <p className="eyebrow">A library of things worth learning</p>
        <h1>Ideas made easier<br />to explore.</h1>
        <p>Thoughtful notes on technology, craft, and the systems behind them.</p>
        <form id="search" className="knowledge-search" onSubmit={search} role="search">
          <label className="sr-only" htmlFor="post-search">Search topics and stories</label>
          <span className="search-mark" aria-hidden="true">⌕</span>
          <input
            id="post-search"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchFocused && (suggestions.length > 0 || (!searchInput.trim() && recentSearches.length > 0))}
            aria-controls="search-suggestions"
            aria-activedescendant={activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : undefined}
            value={searchInput}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={onSearchKeyDown}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search topics and stories"
          />
          {searchInput && (
            <button className="search-clear" type="button" aria-label="Clear search" onClick={() => setSearchInput('')}>×</button>
          )}
          <button className="search-submit" type="submit">Search</button>
          {searchFocused && (suggestions.length > 0 || (!searchInput.trim() && recentSearches.length > 0)) && (
            <div className="search-suggestions" id="search-suggestions" role="listbox">
              {!searchInput.trim() ? (
                <>
                  <div className="suggestion-heading">
                    <span>Recent searches</span>
                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={clearRecentSearches}>Clear</button>
                  </div>
                  {recentSearches.map((item, index) => (
                    <button
                      key={`${item}-${index}`}
                      className="suggestion-item"
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => { setSearchInput(item); saveRecentSearch(item); setSearchFocused(false); setSearchParams({ search: item }); }}
                    >
                      <span aria-hidden="true">↺</span><span>{item}</span>
                    </button>
                  ))}
                </>
              ) : suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  id={`suggestion-${index}`}
                  className={`suggestion-item${activeSuggestion === index ? ' active' : ''}`}
                  type="button"
                  role="option"
                  aria-selected={activeSuggestion === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveSuggestion(index)}
                  onClick={() => selectSuggestion(suggestion)}
                >
                  <span className="suggestion-kind">{suggestion.kind === 'section' ? 'Section' : 'Blog'}</span>
                  <span className="suggestion-copy"><strong>{suggestion.title}</strong><small>{suggestion.path}</small></span>
                </button>
              ))}
            </div>
          )}
          {searchFocused && suggestionError && <output className="search-suggestion-error">{suggestionError}</output>}
        </form>
      </section>

      <section className="topic-section" id="topics" aria-labelledby="topics-heading">
        <div className="section-heading topic-section-heading">
          <div><p className="eyebrow">A collection of complete stories</p><h2 id="topics-heading">Explore blogs</h2></div>
          {searchParams.has('search') && <Link to="/">Clear search</Link>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {loading ? <output className="muted">Loading blogs…</output> : posts.length ? (
          <div className="blog-card-grid">
            {posts.map((post) => (
              <article className="blog-card" key={post.id}>
                <p className="eyebrow">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Knowledge guide'}</p>
                <h3><Link to={`/article/${post.slug}`}>{post.title}</Link></h3>
                <p>{getPostSummary(post) || 'Explore this complete guide and its nested sections.'}</p>
                <Link className="text-link blog-card-link" to={`/article/${post.slug}`}>Explore blog <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        ) : <p className="muted">No published blogs match your search.</p>}
        {pagination?.totalPages > 1 && (
          <nav className="pagination" aria-label="Blog pages">
            <button className="button secondary" type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button className="button secondary" type="button" disabled={page >= pagination.totalPages} onClick={() => goToPage(page + 1)}>Next</button>
          </nav>
        )}
      </section>
    </Layout>
  );
}
