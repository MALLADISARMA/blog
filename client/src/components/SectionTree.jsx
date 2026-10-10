import { Link } from 'react-router-dom';

export function SectionTree({ sections }) {
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
