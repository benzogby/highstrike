"use client";

import { useEditor, useEditorState, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Youtube from "@tiptap/extension-youtube";

// A lesson's notes, edited as the same TipTap (ProseMirror) document the import brought over from Whop and the member
// page draws (src/components/education/Notes.tsx): paragraphs, H2/H3 headings, bullet and numbered lists, line breaks,
// bold, italic, underline, links and YouTube videos. Nothing else is offered, so nothing is saved that Notes can't draw.

const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    link: { openOnClick: false, autolink: true, protocols: ["mailto"], HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } },
  }),
  Youtube.configure({ nocookie: true, controls: true }),
];

function Tool({ on, active, label, children }: { on: () => void; active?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`min-w-8 rounded-md px-2 py-1 text-xs font-semibold transition ${active ? "bg-accent/15 text-accent" : "text-ink-2 hover:bg-panel-2 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      link: e.isActive("link"),
    }),
  });
  const chain = () => editor.chain().focus();
  function link() {
    const was = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link address (leave empty to remove the link)", was ?? "https://");
    if (href === null) return;
    if (!href.trim() || href.trim() === "https://") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: href.trim() }).run();
  }
  function youtube() {
    const src = window.prompt("YouTube link");
    if (src?.trim()) chain().setYoutubeVideo({ src: src.trim() }).run();
  }
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5">
      <Tool label="Bold" active={s.bold} on={() => chain().toggleBold().run()}>B</Tool>
      <Tool label="Italic" active={s.italic} on={() => chain().toggleItalic().run()}><em>I</em></Tool>
      <Tool label="Underline" active={s.underline} on={() => chain().toggleUnderline().run()}><u>U</u></Tool>
      <span className="mx-1 h-4 w-px bg-line" />
      <Tool label="Heading" active={s.h2} on={() => chain().toggleHeading({ level: 2 }).run()}>H2</Tool>
      <Tool label="Subheading" active={s.h3} on={() => chain().toggleHeading({ level: 3 }).run()}>H3</Tool>
      <Tool label="Bulleted list" active={s.bullet} on={() => chain().toggleBulletList().run()}>• List</Tool>
      <Tool label="Numbered list" active={s.ordered} on={() => chain().toggleOrderedList().run()}>1. List</Tool>
      <span className="mx-1 h-4 w-px bg-line" />
      <Tool label="Link" active={s.link} on={link}>Link</Tool>
      <Tool label="YouTube video" on={youtube}>YouTube</Tool>
    </div>
  );
}

/** `onChange` gets the document, or null when the notes are empty. Remount (key) to load another lesson. */
export default function NotesEditor({ initial, onChange }: { initial: unknown; onChange: (doc: JSONContent | null) => void }) {
  const doc = initial as JSONContent | null;
  const editor = useEditor({
    extensions,
    content: doc && doc.type === "doc" ? doc : "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "notes-editor min-h-64 max-w-none px-4 py-3 text-[15px] leading-relaxed text-ink-2 outline-none [&_a]:text-accent [&_a]:underline [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-5 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_strong]:text-ink [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_iframe]:mt-4 [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full [&_iframe]:max-w-xl [&_iframe]:rounded-lg",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? null : e.getJSON()),
  });
  return (
    <div className="rounded-xl border border-line bg-panel-2 focus-within:border-accent/60">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
