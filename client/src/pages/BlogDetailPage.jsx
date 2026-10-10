import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { blogApi } from '../api/blogApi.js';
import { Layout } from '../components/Layout.jsx';
import { prepareArticleHtml, SafeArticleContent } from '../components/SafeArticleContent.jsx';

function findContentSectionPath(sections, id, path = []) {
  for (const section of sections || []) {
    const nextPath = [...path, section];
    if (String(section.id) === String(id)) return nextPath;
    const found = findContentSectionPath(section.children || [], id, nextPath);
    if (found) return found;
  }
  return null;
}

function BlogSectionNode({ section, depth, slug }) {
  return (
    <section className={`reading-section depth-${Math.min(depth, 5)}`}>
      <h2 className={`reading-section-heading level-${Math.min(depth + 2, 6)}`}>
        <Link to={`/article/${slug}/section/${section.id}`}>
          <span className="reading-section-chevron" aria-hidden="true">→</span>
          <span>{section.title}</span>
        </Link>
      </h2>
      {section.children?.length > 0 && (
        <div className="reading-subsections">
          {section.children.map((child) => (
            <BlogSectionNode key={child.id} section={child} depth={depth + 1} slug={slug} />
          ))}
        </div>
      )}
    </section>
  );
}

function ArticleReadingView({
  post,
  currentSection,
  sectionPath,
  relatedPosts,
  relatedError,
  articleHeadings,
}) {
  const currentIndex = relatedPosts.findIndex((item) => item.slug === post.slug);
  const previousPost = currentIndex >= 0 ? relatedPosts[currentIndex + 1] : null;
  const nextPost = currentIndex > 0 ? relatedPosts[currentIndex - 1] : null;
  const otherRelatedPosts = relatedPosts.filter((item) => item.slug !== post.slug).slice(0, 3);

  return (
    <div className="reading-layout">
      <article className="article">
        <Link className="text-link" to="/">← All stories</Link>
        {(post.sections?.length > 0 || sectionPath.length > 0) && (
          <nav className="breadcrumbs" aria-label="Section breadcrumb">
            <span><Link to={`/article/${post.slug}`}>{post.title}</Link></span>
            {sectionPath.map((section) => (
              <span key={section.id}>
                <span className="breadcrumb-separator">→</span>
                {String(section.id) === String(currentSection?.id) ? section.title : (
                  <Link to={`/article/${post.slug}/section/${section.id}`}>{section.title}</Link>
                )}
              </span>
            ))}
          </nav>
        )}
        <p className="eyebrow article-date">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}</p>
        <h1>{currentSection?.title || post.title}</h1>
        {!currentSection && post.excerpt && <p className="article-excerpt">{post.excerpt}</p>}
        <SafeArticleContent content={currentSection?.content || (!currentSection ? post.content : '')} withHeadingIds copyCode />
        {!currentSection && post.sections?.length > 0 && (
          <div className="blog-reading-sections" aria-label="Blog sections">
            {post.sections.map((section) => (
              <BlogSectionNode key={section.id} section={section} depth={0} slug={post.slug} />
            ))}
          </div>
        )}
        {currentSection?.children?.length > 0 && (
          <section className="blog-reading-sections" aria-label="Subsections">
            <p className="eyebrow">In this section</p>
            {currentSection.children.map((child) => (
              <BlogSectionNode key={child.id} section={child} depth={0} slug={post.slug} />
            ))}
          </section>
        )}
        {(previousPost || nextPost) && (
          <nav className="article-sequence" aria-label="Previous and next stories">
            {previousPost ? <Link to={`/article/${previousPost.slug}`}><span>Previous story</span><strong>{previousPost.title}</strong></Link> : <span />}
            {nextPost ? <Link className="next-story" to={`/article/${nextPost.slug}`}><span>Next story</span><strong>{nextPost.title}</strong></Link> : <span />}
          </nav>
        )}
        {(otherRelatedPosts.length > 0 || relatedError) && (
          <section className="related-stories" aria-labelledby="related-heading">
            <p className="eyebrow">Keep exploring</p>
            <h2 id="related-heading">More in {sectionPath.at(-1)?.name || 'this topic'}</h2>
            {relatedError ? <p className="muted">{relatedError}</p> : otherRelatedPosts.map((related) => (
              <Link className="related-story" key={related.id} to={`/article/${related.slug}`}>{related.title}<span aria-hidden="true">→</span></Link>
            ))}
          </section>
        )}
      </article>
      {!currentSection && articleHeadings.length > 0 && (
        <aside className="article-toc" aria-label="On this page">
          <p className="eyebrow">On this page</p>
          <nav>
            {articleHeadings.map((heading) => (
              <a className={`toc-level-${heading.level}`} key={heading.id} href={`#${heading.id}`}>{heading.title}</a>
            ))}
          </nav>
        </aside>
      )}
    </div>
  );
}

export default function BlogDetailPage() {
  const { slug, sectionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [relatedError, setRelatedError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const articleHeadings = useMemo(() => (post ? prepareArticleHtml(post.content).headings : []), [post]);
  const sectionPath = useMemo(
    () => (sectionId && post ? findContentSectionPath(post.sections, sectionId) || [] : []),
    [post, sectionId],
  );
  const currentSection = sectionPath.at(-1) || null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPost(null);
    setRelatedPosts([]);
    setError('');
    setRelatedError('');
    blogApi.get(slug)
      .then(async (postData) => {
        if (cancelled) return;
        setPost(postData.post);
        if (postData.post.sectionId) {
          try {
            const relatedData = await blogApi.list({ sectionId: postData.post.sectionId, limit: 100 });
            if (!cancelled) setRelatedPosts(relatedData.posts);
          } catch {
            if (!cancelled) setRelatedError('Related stories are temporarily unavailable.');
          }
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!post || sectionId || !location.hash) return;
    const legacySectionId = /^#section-(\d+)$/.exec(location.hash)?.[1];
    if (!legacySectionId) return;
    const path = findContentSectionPath(post.sections, legacySectionId);
    if (path) navigate(`/article/${post.slug}/section/${legacySectionId}`, { replace: true });
  }, [location.hash, navigate, post, sectionId]);

  if (loading) return <Layout><output className="muted">Loading story…</output></Layout>;
  if (error) {
    return <Layout><section className="article"><p className="error" role="alert">{error}</p><Link className="text-link" to="/">← All stories</Link></section></Layout>;
  }
  if (!post) return <Layout><output className="muted">Story unavailable.</output></Layout>;
  if (sectionId && !currentSection) {
    return <Layout><section className="article"><p className="error" role="alert">This subsection could not be found.</p><Link className="text-link" to={`/article/${post.slug}`}>← Back to {post.title}</Link></section></Layout>;
  }

  return (
    <Layout>
      <ArticleReadingView
        post={post}
        currentSection={currentSection}
        sectionPath={sectionPath}
        relatedPosts={relatedPosts}
        relatedError={relatedError}
        articleHeadings={articleHeadings}
      />
    </Layout>
  );
}
