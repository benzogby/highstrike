import { isOwnHost, rewriteCss } from "@/lib/inbox-mail";
import type { Attachment } from "./types";

/**
 * Senders' HTML, made safe in the browser by the browser's own parser (DOMParser makes an inert document: nothing in it
 * loads or runs), then walked tag by tag against what an email needs. Three walls stand between a sender and this site:
 * this list, the message frame's sandbox with no scripts (features/inbox/message-frame.tsx), and the frame's own
 * Content-Security-Policy, which lets pictures load only from this mailbox's files and, once Ben presses Show images, from
 * this server's picture fetcher (app/api/admin/inbox/img). A sender's pictures never load straight from the sender, and
 * nothing in a message can make the browser call this site with Ben's cookies.
 *
 * The editor's own (sanitizeForEditor) is stricter still: what goes in there lives in the page itself.
 */

const HTML_NS = "http://www.w3.org/1999/xhtml";
/** Gone with everything in them. */
const DROP = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "link", "meta", "base", "noscript", "template", "audio", "video",
  "source", "track", "canvas", "input", "button", "select", "textarea", "option", "optgroup", "datalist", "output", "dialog", "portal", "slot",
  "param", "title", "head", "map", "area", "picture",
]);
/** Kept (anything else is unwrapped: its text stays, the tag goes). */
const MAIL_TAGS = new Set([
  "a", "abbr", "address", "article", "aside", "b", "bdi", "bdo", "big", "blockquote", "br", "caption", "center", "cite", "code", "col", "colgroup",
  "dd", "del", "details", "dfn", "div", "dl", "dt", "em", "figcaption", "figure", "font", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr",
  "i", "img", "ins", "kbd", "label", "li", "main", "mark", "nav", "ol", "p", "pre", "q", "rp", "rt", "ruby", "s", "samp", "section", "small", "span",
  "strike", "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "tt", "u", "ul", "var", "wbr",
]);
const MAIL_ATTRS = new Set([
  "style", "class", "id", "dir", "lang", "title", "align", "valign", "width", "height", "bgcolor", "color", "border", "cellpadding", "cellspacing",
  "colspan", "rowspan", "role", "face", "size", "start", "type", "span", "nowrap", "alt", "summary", "headers", "scope", "abbr", "datetime", "open",
  "hspace", "vspace", "name", "background", "href", "src", "reversed", "frame", "rules", "char", "charoff", "clear", "compact", "noshade",
]);
const EDITOR_TAGS = new Set([
  "a", "b", "strong", "i", "em", "u", "s", "strike", "br", "p", "div", "span", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "font", "img", "table",
  "tbody", "thead", "tr", "td", "th", "hr", "pre", "code", "sub", "sup", "small", "big", "center",
]);
const EDITOR_ATTRS = new Set(["style", "dir", "align", "color", "face", "size", "width", "height", "border", "cellpadding", "cellspacing", "colspan", "rowspan", "valign", "bgcolor", "alt", "href", "src", "class"]);

type Ctx = { showImages: boolean; origin: string; remote: number; cid: (cid: string) => string | null; editor: boolean };

/** Where a picture may load from: this mailbox's file for a cid:, a small inline data: picture, or (shown) through the fetcher. */
function pictureUrl(raw: string, ctx: Ctx): string | null {
  const v = raw.trim();
  if (/^cid:/i.test(v)) return ctx.cid(v.slice(4).replace(/^<|>$/g, ""));
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(v)) return v.length < (ctx.editor ? 700_000 : 3_000_000) ? v : null;
  if (!/^(https?:)?\/\//i.test(v)) return null;
  const abs = v.startsWith("//") ? `https:${v}` : v;
  let host: string;
  try {
    host = new URL(abs).hostname;
  } catch {
    return null;
  }
  if (isOwnHost(host)) return null;
  // The editor keeps a picture's own address (it's going out in a message), only ever over https and never this site's.
  if (ctx.editor) return abs.startsWith("https://") ? abs : null;
  ctx.remote++;
  return ctx.showImages ? `${ctx.origin}/api/admin/inbox/img?u=${encodeURIComponent(abs)}` : null;
}

function linkUrl(raw: string): string | null {
  const v = raw.trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(v) ? v : null;
}

function walk(node: Element, ctx: Ctx, tags: Set<string>, attrs: Set<string>) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 8) {
      child.remove();
      continue;
    }
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    const tag = el.localName;
    if (el.namespaceURI !== HTML_NS || DROP.has(tag)) {
      el.remove();
      continue;
    }
    if (!tags.has(tag)) {
      walk(el, ctx, tags, attrs);
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!attrs.has(name) && !name.startsWith("aria-")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "style") {
        const css = rewriteCss(attr.value, (u) => pictureUrl(u, ctx));
        if (css.trim()) el.setAttribute("style", css);
        else el.removeAttribute("style");
      } else if (name === "href") {
        const href = tag === "a" ? linkUrl(attr.value) : null;
        if (href) el.setAttribute("href", href);
        else el.removeAttribute("href");
      } else if (name === "src" || name === "background") {
        const src = tag === "img" || name === "background" ? pictureUrl(attr.value, ctx) : null;
        if (src) el.setAttribute(name, src);
        else el.removeAttribute(name);
      } else if (name === "class" && ctx.editor && !/^(gmail_signature|gmail_signature_prefix)$/.test(attr.value)) {
        el.removeAttribute("class");
      }
    }
    if (tag === "a") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
    walk(el, ctx, tags, attrs);
  }
}

/** Gmail's "•••": the quoted history under a reply folded away, when the reply has words of its own above it. */
function foldQuote(root: Element) {
  const q = root.querySelector("div.gmail_quote, div.gmail_quote_container, blockquote[type='cite'], div.yahoo_quoted, div#divRplyFwdMsg, div#appendonsend, div.moz-cite-prefix");
  const parent = q?.parentElement;
  if (!q || !parent) return;
  const doc = root.ownerDocument;
  const range = doc.createRange();
  range.setStart(root, 0);
  range.setEndBefore(q);
  if (!range.toString().trim()) return;
  const details = doc.createElement("details");
  details.className = "rq";
  const summary = doc.createElement("summary");
  summary.title = "Show trimmed content";
  summary.textContent = "•••";
  details.appendChild(summary);
  parent.insertBefore(details, q);
  let n: ChildNode | null = q;
  while (n) {
    const next: ChildNode | null = n.nextSibling;
    details.appendChild(n);
    n = next;
  }
}

export type CleanMail = { html: string; remote: number };

/**
 * A message's HTML for its frame: the sender's styles kept (with their addresses rewritten), the body's own colours on a
 * wrapper, everything else as MAIL_TAGS allows. `remote` counts the sender's own pictures, for "Images are not displayed".
 */
export function sanitizeMail(raw: string, o: { showImages: boolean; origin: string; files: Attachment[]; fileUrl: (a: Attachment) => string }): CleanMail {
  const doc = new DOMParser().parseFromString(raw, "text/html");
  const byCid = new Map(o.files.filter((f) => f.cid).map((f) => [f.cid!.toLowerCase(), f]));
  const ctx: Ctx = {
    showImages: o.showImages, origin: o.origin, remote: 0, editor: false,
    cid: (cid) => {
      const f = byCid.get(cid.toLowerCase());
      return f ? `${o.origin}${o.fileUrl(f)}` : null;
    },
  };
  const styles = Array.from(doc.querySelectorAll("style"), (s) => rewriteCss(s.textContent ?? "", (u) => pictureUrl(u, ctx)).replace(/<\/?style/gi, ""));
  const wrapper = doc.createElement("div");
  wrapper.setAttribute("data-mail-body", "");
  for (const name of ["bgcolor", "style", "background", "dir"]) {
    const v = doc.body.getAttribute(name);
    if (v) wrapper.setAttribute(name, v);
  }
  const text = doc.body.getAttribute("text");
  if (text && /^#?[0-9a-z]{3,20}$/i.test(text)) wrapper.setAttribute("color", text);
  while (doc.body.firstChild) wrapper.appendChild(doc.body.firstChild);
  doc.body.appendChild(wrapper);
  walk(doc.body, ctx, MAIL_TAGS, MAIL_ATTRS);
  const root = doc.body.querySelector("[data-mail-body]") ?? doc.body;
  foldQuote(root);
  return { html: styles.map((s) => `<style>${s}</style>`).join("") + doc.body.innerHTML, remote: ctx.remote };
}

/**
 * HTML going into the editor (a draft reopened, a signature, a paste): plain formatting, links, tables and https or
 * small inline pictures, nothing else. It lives in the page itself, so this is its only wall.
 */
export function sanitizeForEditor(raw: string): string {
  const doc = new DOMParser().parseFromString(raw, "text/html");
  const ctx: Ctx = { showImages: false, origin: "", remote: 0, editor: true, cid: () => null };
  walk(doc.body, ctx, EDITOR_TAGS, EDITOR_ATTRS);
  return doc.body.innerHTML;
}

/** The plain text of some HTML, as the browser reads it (for a quote's one-line preview). */
export function textOf(html: string): string {
  return (new DOMParser().parseFromString(html, "text/html").body.textContent ?? "").replace(/\s+/g, " ").trim();
}
