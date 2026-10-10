import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';

const toolbarItems = [
  { label: 'Bold', command: (editor) => editor.chain().focus().toggleBold().run(), active: (editor) => editor.isActive('bold') },
  { label: 'Italic', command: (editor) => editor.chain().focus().toggleItalic().run(), active: (editor) => editor.isActive('italic') },
  { label: 'Heading 2', command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: (editor) => editor.isActive('heading', { level: 2 }) },
  { label: 'Heading 3', command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: (editor) => editor.isActive('heading', { level: 3 }) },
  { label: 'Bulleted list', command: (editor) => editor.chain().focus().toggleBulletList().run(), active: (editor) => editor.isActive('bulletList') },
  { label: 'Numbered list', command: (editor) => editor.chain().focus().toggleOrderedList().run(), active: (editor) => editor.isActive('orderedList') },
  { label: 'Blockquote', command: (editor) => editor.chain().focus().toggleBlockquote().run(), active: (editor) => editor.isActive('blockquote') },
];

function preservePastedBold(html) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  for (const element of document.body.querySelectorAll('[style]')) {
    const weight = element.style.fontWeight.trim().toLowerCase();
    if (!/^(?:bold|bolder|[6-9]00|1000)$/.test(weight) || /^(?:b|strong)$/i.test(element.tagName)) {
      continue;
    }

    const bold = document.createElement('strong');
    while (element.firstChild) bold.append(element.firstChild);
    element.append(bold);
    element.style.removeProperty('font-weight');
    if (!element.getAttribute('style')?.trim()) element.removeAttribute('style');
  }
  return document.body.innerHTML;
}

export function RichTextEditor({ content, onChange, onUploadImage }) {
  const onChangeRef = useRef(onChange);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: false, HTMLAttributes: { class: 'article-image' } }),
    ],
    content,
    editorProps: {
      transformPastedHTML: preservePastedBold,
      attributes: {
        'aria-label': 'Article content editor',
        class: 'rich-text-area',
      },
    },
    onUpdate: ({ editor: updatedEditor }) => onChangeRef.current(updatedEditor.getHTML()),
  }, []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const insertImage = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const { url } = await onUploadImage(file);
      editor?.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (error) {
      setUploadError(error.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }, [editor, onUploadImage]);

  if (!editor) return <div className="rich-text-editor" aria-busy="true">Loading editor…</div>;

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label="Text formatting">
        {toolbarItems.map(({ label, command, active }) => (
          <button
            key={label}
            className={`button secondary small${active(editor) ? ' active' : ''}`}
            type="button"
            aria-label={label}
            aria-pressed={active(editor)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command(editor)}
          >
            {label}
          </button>
        ))}
        <label className={`button secondary small image-upload-button${uploading ? ' disabled' : ''}`}>
          {uploading ? 'Uploading…' : 'Add image'}
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            disabled={uploading}
            onChange={insertImage}
          />
        </label>
      </div>
      <EditorContent editor={editor} />
      <p className="muted editor-help">Use the toolbar to format your story. Images are limited to 5 MB.</p>
      {uploadError && <p className="error" role="alert">{uploadError}</p>}
    </div>
  );
}
