import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sectionApi } from '../api/sectionApi.js';
import { Layout } from '../components/Layout.jsx';
import { buildSectionTree, flattenSections } from '../components/SectionTree.jsx';

const blankSection = { name: '', slug: '', parentId: '' };

function collectDescendants(section, ids = new Set()) {
  for (const child of section.children || []) {
    ids.add(String(child.id));
    collectDescendants(child, ids);
  }
  return ids;
}

function SectionNodes({ sections, onEdit, onRemove }) {
  return sections.map((section) => (
    <li key={section.id}>
      <article className="admin-item section-item">
        <div><h3>{section.name}</h3><small>/{section.slug}</small></div>
        <div className="button-row">
          <button className="button secondary small" type="button" onClick={() => onEdit(section)}>Edit / move</button>
          <button className="button danger small" type="button" onClick={() => onRemove(section)}>Delete</button>
        </div>
      </article>
      {section.children.length > 0 && <ul className="section-children"><SectionNodes sections={section.children} onEdit={onEdit} onRemove={onRemove} /></ul>}
    </li>
  ));
}

export default function SectionManagementPage() {
  const [sections, setSections] = useState([]);
  const [section, setSection] = useState(blankSection);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const tree = useMemo(() => buildSectionTree(sections), [sections]);
  const flat = useMemo(() => flattenSections(tree), [tree]);
  const invalidParents = useMemo(() => {
    const current = flat.find((item) => String(item.id) === String(section.id));
    return current ? collectDescendants(current) : new Set();
  }, [flat, section.id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await sectionApi.adminList();
      setSections(result.sections);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function save(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      await sectionApi.save({ ...section, parentId: section.parentId || null });
      setSection(blankSection);
      setNotice('Section saved.');
      await refresh();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  function edit(item) {
    setSection({ id: item.id, name: item.name, slug: item.slug, parentId: item.parentId || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.name}”? Sections with posts or child sections cannot be deleted.`)) return;
    try {
      await sectionApi.remove(item.id);
      setNotice('Section deleted.');
      await refresh();
    } catch (removeError) {
      setError(removeError.message);
    }
  }

  let sectionList;
  if (loading) {
    sectionList = <output className="muted">Loading sections…</output>;
  } else if (tree.length) {
    sectionList = <ul className="section-tree-admin"><SectionNodes sections={tree} onEdit={edit} onRemove={remove} /></ul>;
  } else {
    sectionList = <p className="muted">No sections created yet.</p>;
  }

  return (
    <Layout>
      <div className="admin-heading">
        <div><p className="eyebrow">Admin workspace</p><h1>Manage sections</h1></div>
        <Link className="button secondary" to="/admin">Back to dashboard</Link>
      </div>
      {notice && <output className="success">{notice}</output>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="admin-grid sections-grid">
        <section className="form-panel">
          <h2>{section.id ? 'Edit or move section' : 'Create section'}</h2>
          <form onSubmit={save}>
            <label htmlFor="section-name"><span>Name</span>
              <input id="section-name" value={section.name} onChange={(event) => setSection({ ...section, name: event.target.value })} required maxLength="100" />
            </label>
            <label htmlFor="section-slug"><span>Slug <span className="muted">(optional)</span></span>
              <input id="section-slug" value={section.slug} onChange={(event) => setSection({ ...section, slug: event.target.value })} maxLength="120" />
            </label>
            <label htmlFor="section-parent"><span>Parent section</span>
              <select id="section-parent" value={section.parentId} onChange={(event) => setSection({ ...section, parentId: event.target.value })}>
                <option value="">Top-level section</option>
                {flat.filter((item) => String(item.id) !== String(section.id) && !invalidParents.has(String(item.id))).map((item) => (
                  <option key={item.id} value={item.id}>{`${'— '.repeat(item.depth)}${item.name}`}</option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button className="button" type="submit">{section.id ? 'Save section' : 'Create section'}</button>
              {section.id && <button className="button secondary" type="button" onClick={() => setSection(blankSection)}>Cancel edit</button>}
            </div>
          </form>
        </section>
        <section>
          <h2>Section hierarchy</h2>
          {sectionList}
        </section>
      </div>
    </Layout>
  );
}
