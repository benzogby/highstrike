import type { ReactNode } from "react";
import YouTubeEmbed from "@/components/education/YouTubeEmbed";

// A lesson's notes as the course editor saved them (a ProseMirror document: paragraphs, headings, lists, line breaks,
// bold, italic, underline, links and the odd YouTube video), drawn as React elements, never as HTML. Anything else the
// editor might hold is drawn as its text.

type Mark = { type: string; attrs?: { href?: unknown } };
type Node = { type: string; text?: string; marks?: Mark[]; attrs?: Record<string, unknown>; content?: Node[] };

function safeHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:" ? u.href : null;
  } catch {
    return null;
  }
}

function youtubeId(src: unknown): string | null {
  if (typeof src !== "string") return null;
  try {
    const u = new URL(src);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    return u.searchParams.get("v") ?? /\/(?:embed|shorts|live|v)\/([\w-]{6,})/.exec(u.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function text(node: Node, key: number): ReactNode {
  let out: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong className="font-semibold text-ink">{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
    else if (mark.type === "underline") out = <u>{out}</u>;
    else if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      if (href) out = <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline-offset-4 hover:underline">{out}</a>;
    }
  }
  return <span key={key}>{out}</span>;
}

const hasText = (n: Node): boolean => (typeof n.text === "string" && n.text.trim().length > 0) || n.type === "youtube" || (n.content ?? []).some(hasText);

function inline(nodes: Node[] | undefined): ReactNode[] {
  return (nodes ?? []).map((n, i) => (n.type === "hardBreak" ? <br key={i} /> : n.type === "text" ? text(n, i) : <span key={i}>{inline(n.content)}</span>));
}

function block(node: Node, key: number, inList = false): ReactNode {
  switch (node.type) {
    case "paragraph":
      if (!hasText(node)) return null;
      return (
        <p key={key} className={inList ? "leading-relaxed" : "mt-3 leading-relaxed"}>
          {inline(node.content)}
        </p>
      );
    case "heading": {
      const level = Number(node.attrs?.level) <= 2 ? 2 : 3;
      if (!hasText(node)) return null;
      return level === 2 ? (
        <h2 key={key} className="mt-8 font-display text-xl font-bold text-ink">
          {inline(node.content)}
        </h2>
      ) : (
        <h3 key={key} className="mt-6 font-display text-lg font-semibold text-ink">
          {inline(node.content)}
        </h3>
      );
    }
    case "orderedList":
    case "bulletList": {
      const items = (node.content ?? []).map((li, i) => (
        <li key={i} className="pl-1">
          {(li.content ?? []).map((c, j) => block(c, j, true))}
        </li>
      ));
      return node.type === "orderedList" ? (
        <ol key={key} className="mt-3 list-decimal space-y-1.5 pl-6">
          {items}
        </ol>
      ) : (
        <ul key={key} className="mt-3 list-disc space-y-1.5 pl-6">
          {items}
        </ul>
      );
    }
    case "youtube": {
      const id = youtubeId(node.attrs?.src);
      return id ? (
        <div key={key} className="mt-5">
          <YouTubeEmbed id={id} title="Video in this lesson's notes" />
        </div>
      ) : null;
    }
    case "hardBreak":
      return <br key={key} />;
    case "text":
      return text(node, key);
    default:
      return node.content ? <div key={key}>{node.content.map((c, i) => block(c, i, inList))}</div> : null;
  }
}

export default function Notes({ body }: { body: unknown }) {
  const doc = body as Node | null;
  if (!doc || !Array.isArray(doc.content) || !doc.content.some(hasText)) return null;
  return <div className="max-w-3xl text-[15px] text-ink-2">{doc.content.map((n, i) => block(n, i))}</div>;
}
