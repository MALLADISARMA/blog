import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi.js';
import { sectionApi } from '../api/sectionApi.js';
import { Layout } from '../components/Layout.jsx';

function findSection(sections, id, path = []) {
  for (const section of sections) {
    const nextPath = [...path, section];
    if (String(section.id) === String(id)) return nextPath;
    const found = findSection(section.children || [], id, nextPath);
    if (found) return found;
  }
  return null;
}

export default function BlogDetailPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [sectionPath, setSectionPath] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPost(null);
    setError('');
    Promise.all([blogApi.get(slug), sectionApi.tree()])
      .then(([postData, sectionData]) => {
        if (cancelled) return;
        setPost(postData.post);
        setSectionPath(findSection(sectionData.sections, postData.post.sectionId) || []);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  let content;
  if (loading) {
    content = <output className="muted">Loading story…</output>;
  } else if (error) {
    content = <section className="article"><p className="error" role="alert">{error}</p><Link className="text-link" to="/">← All stories</Link></section>;
  } else if (post) {
    content = (
      <article className="article">
        <Link className="text-link" to="/">← All stories</Link>
        {sectionPath.length > 0 && (
          <nav className="breadcrumbs" aria-label="Section breadcrumb">
            {sectionPath.map((section, index) => (
              <span key={section.id}>{index > 0 && ' / '}<Link to={`/?section=${encodeURIComponent(section.id)}`}>{section.name}</Link></span>
            ))}
          </nav>
        )}
        <p className="eyebrow">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}</p>
        <h1>{post.title}</h1>
        {post.excerpt && <p className="article-excerpt">{post.excerpt}</p>}
        <div className="article-content">{post.content}</div>
      </article>
    );
  }

  return (
    <Layout>
      {content}
    </Layout>
  );
}
