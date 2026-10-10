import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export function SectionTree({ sections, selectedId = '', onLeafSelect, defaultExpandedId = '' }) {
  if (!sections?.length) return null;
  return (
    <ul className="topic-tree">
      {sections.map((section) => (
        <SectionTreeNode
          key={section.id}
          section={section}
          selectedId={selectedId}
          onLeafSelect={onLeafSelect}
          defaultExpandedId={defaultExpandedId}
        />
      ))}
    </ul>
  );
}

function SectionTreeNode({ section, selectedId, onLeafSelect, defaultExpandedId }) {
  const hasChildren = Boolean(section.children?.length);
  const includesDefault = (node) => String(node.id) === String(defaultExpandedId)
    || (node.children || []).some(includesDefault);
  const [expanded, setExpanded] = useState(() => includesDefault(section));

  useEffect(() => {
    if (defaultExpandedId && includesDefault(section)) setExpanded(true);
  }, [defaultExpandedId, section]);

  return (
    <li className={`topic-tree-node${String(selectedId) === String(section.id) ? ' selected' : ''}`}>
      <div className="topic-tree-row">
        {hasChildren ? (
          <button
            className={`topic-chevron${expanded ? ' expanded' : ''}`}
            type="button"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${section.name}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <span aria-hidden="true">›</span>
          </button>
        ) : <span className="topic-leaf-mark" aria-hidden="true">·</span>}
        <Link
          className="topic-tree-link"
          to={`/?section=${encodeURIComponent(section.id)}`}
          onClick={(event) => {
            if (!hasChildren && onLeafSelect) {
              event.preventDefault();
              onLeafSelect(section);
            }
          }}
        >
          {section.name}
        </Link>
      </div>
      {hasChildren && (
        <div className={`topic-children${expanded ? ' open' : ''}`} aria-hidden={!expanded} inert={!expanded}>
          <div className="topic-children-inner">
            <SectionTree
              sections={section.children}
              selectedId={selectedId}
              onLeafSelect={onLeafSelect}
              defaultExpandedId={defaultExpandedId}
            />
          </div>
        </div>
      )}
    </li>
  );
}

export function buildSectionTree(sections) {
  const nodes = new Map(sections.map((section) => [String(section.id), { ...section, children: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    const parent = node.parentId && nodes.get(String(node.parentId));
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function flattenSections(sections, depth = 0, result = []) {
  for (const section of sections) {
    result.push({ ...section, depth });
    flattenSections(section.children || [], depth + 1, result);
  }
  return result;
}
