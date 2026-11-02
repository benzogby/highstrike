/**
 * The Education lesson videos' HLS playlists (ported from getripping.com's Ripping University, 2026-11-02): read and
 * rewrite the m3u8 text in the private `lessons` bucket, so the stream route can hand a player each playlist with every
 * segment behind a short-lived signed link, and nothing a playlist names can reach outside its own lesson's folder.
 *
 * Pure and framework-free on purpose (no "@/" imports, no Node APIs, nothing but erasable types), so the route and the
 * player can both load it as it is.
 *
 * The parts of RFC 8216 that matter here: a playlist is lines ending in LF or CRLF, and a line is blank, a tag ("#EXT…"),
 * a comment (any other "#…") or a URI. In a master playlist the URI after each EXT-X-STREAM-INF is a variant (a media
 * playlist); in a media playlist every URI line is a segment, and EXT-X-MAP (the fMP4 init segment) and EXT-X-KEY carry
 * theirs in a quoted URI="…" attribute. Everything else passes through untouched.
 */

/** What the stream route answers with, and what the player asks the browser about. */
export const HLS_MIME = "application/vnd.apple.mpegurl";

/** Longest relative path a lesson file may have (its full key adds `<lessonId>/<version>/`, well inside storage's 1024). */
export const MAX_REL_PATH = 200;

/** A published version's id: the pipeline's content hash, which is also its folder (`lessons/<lessonId>/<version>/`). */
export function isLessonVersion(v: unknown): v is string {
  return typeof v === "string" && /^[a-z0-9]{8,40}$/.test(v);
}

const REL_PART = /^[a-z0-9_-][a-z0-9_.-]*$/;
const REL_EXT = /\.(?:m3u8|m4s|mp4|ts|jpg)$/;

/**
 * A file path inside a lesson's storage folder, as the pipeline uploads it and the routes accept it: lower-case letters,
 * digits, "_", ".", "-" and "/" only, no "..", nothing absolute, no empty or dot-led parts ("a//b", "./a", ".x"), and one
 * of the five kinds of file a lesson has (playlists, fMP4 and TS segments, init segments, the poster). Every key the
 * routes build is `<lessonId>/<version>/<one of these>`, so nothing can reach out of its own lesson's folder.
 */
export function isSafeRelPath(p: unknown): p is string {
  return typeof p === "string" && p.length > 0 && p.length <= MAX_REL_PATH && !p.includes("..") && REL_EXT.test(p) && p.split("/").every((part) => REL_PART.test(part));
}

/** The folder a relative path sits in ("" at the top): "1080p/index.m3u8" → "1080p". */
export function dirOf(path: string): string {
  const k = path.lastIndexOf("/");
  return k < 0 ? "" : path.slice(0, k);
}

/**
 * A playlist's URI resolved against the folder its playlist sits in (`dir`, "" at the top), or null when it isn't a plain
 * relative path that stays in that folder's tree: an absolute URL, a query string, a "../" or a name isSafeRelPath
 * refuses. A leading "./" is the one spelling it forgives, since it changes nothing.
 */
export function resolveUri(dir: string, uri: string): string | null {
  const rel = uri.trim().replace(/^(?:\.\/)+/, "");
  const full = dir ? `${dir}/${rel}` : rel;
  return isSafeRelPath(full) ? full : null;
}

/** Which files a lesson folder may hold, by extension, and the content types each may be uploaded as. */
const FILE_TYPES = new Map<string, string[]>([
  ["m3u8", [HLS_MIME, "application/x-mpegurl", "audio/mpegurl", "audio/x-mpegurl"]],
  ["m4s", ["video/iso.segment", "video/mp4", "audio/mp4"]],
  ["mp4", ["video/mp4", "audio/mp4"]],
  ["ts", ["video/mp2t"]],
  ["jpg", ["image/jpeg"]],
]);

/** Whether `contentType` fits the file at `path` (case and any "; codecs=…" ignored), so storage serves each one right. */
export function fileTypeOk(path: string, contentType: unknown): boolean {
  const dot = path.lastIndexOf(".");
  if (dot < 0 || typeof contentType !== "string") return false;
  return (FILE_TYPES.get(path.slice(dot + 1)) ?? []).includes(contentType.split(";")[0].trim().toLowerCase());
}

type Line = { text: string; eol: string };

/** The playlist's lines, each with the break that ended it, so a rewrite keeps LF or CRLF exactly as it found them. */
function splitLines(playlist: string): Line[] {
  const parts = playlist.replace(/^\uFEFF/, "").split(/(\r?\n)/);
  const out: Line[] = [];
  for (let i = 0; i < parts.length; i += 2) out.push({ text: parts[i], eol: parts[i + 1] ?? "" });
  return out;
}

type Kind = "blank" | "tag" | "comment" | "uri";
/** `t` is a trimmed line. Tags start "#EXT"; any other "#" line is a comment and is never read as anything. */
const kindOf = (t: string): Kind => (!t ? "blank" : t.startsWith("#EXT") ? "tag" : t.startsWith("#") ? "comment" : "uri");
/** "#EXT-X-MAP:URI=…" → "EXT-X-MAP". */
const tagName = (t: string) => {
  const colon = t.indexOf(":");
  return (colon < 0 ? t.slice(1) : t.slice(1, colon)).toUpperCase();
};

/**
 * A tag's URI attribute: the URI and where its value (quotes included) sits in the trimmed line, or null. The attribute
 * list is walked pair by pair, so a quoted value elsewhere (CODECS="avc1.640028,mp4a.40.2", a BYTERANGE before the URI)
 * never confuses it, and a URI="…" inside a comment is never read at all.
 */
function uriAttribute(t: string): { uri: string; start: number; end: number } | null {
  const colon = t.indexOf(":");
  if (colon < 0) return null;
  let i = colon + 1;
  while (i < t.length) {
    const eq = t.indexOf("=", i);
    if (eq < 0) return null;
    const name = t.slice(i, eq).trim().toUpperCase();
    let start = eq + 1;
    while (t[start] === " ") start++;
    let end: number;
    if (t[start] === '"') {
      const close = t.indexOf('"', start + 1);
      if (close < 0) return null; // an unterminated quote: nothing after it can be trusted
      end = close + 1;
    } else {
      const comma = t.indexOf(",", start);
      end = comma < 0 ? t.length : comma;
    }
    if (name === "URI") {
      const raw = t.slice(start, end).trim();
      const uri = raw.startsWith('"') ? raw.slice(1, -1) : raw;
      return uri ? { uri, start, end } : null;
    }
    const next = t.indexOf(",", end);
    if (next < 0) return null;
    i = next + 1;
  }
  return null;
}

/** The tags in a media playlist whose URI attribute the player fetches straight from storage. */
const MEDIA_URI_TAGS = new Set(["EXT-X-MAP", "EXT-X-KEY"]);

/** "master" (it lists variants), "media" (it lists segments) or null (not an HLS playlist at all). */
export function playlistKind(playlist: string): "master" | "media" | null {
  const lines = splitLines(playlist).map((l) => l.text.trim()).filter(Boolean);
  if (lines[0] !== "#EXTM3U") return null;
  const tags = new Set(lines.filter((t) => kindOf(t) === "tag").map(tagName));
  if (tags.has("EXT-X-STREAM-INF") || tags.has("EXT-X-I-FRAME-STREAM-INF") || tags.has("EXT-X-MEDIA")) return "master";
  return tags.has("EXTINF") || tags.has("EXT-X-TARGETDURATION") ? "media" : null;
}

/** The variant URIs of a master playlist, in order: the URI line after each EXT-X-STREAM-INF (comments between skipped). */
export function masterVariants(playlist: string): string[] {
  const out = new Set<string>();
  let waiting = false;
  for (const { text } of splitLines(playlist)) {
    const t = text.trim();
    const kind = kindOf(t);
    if (kind === "tag" && tagName(t) === "EXT-X-STREAM-INF") waiting = true;
    else if (kind === "uri" && waiting) {
      out.add(t);
      waiting = false;
    }
  }
  return [...out];
}

/**
 * Every URI a master playlist hands the player: its variants and any URI="…" on its tags (alternate audio or subtitles,
 * I-frame playlists, session keys). The publish route insists each one is a rendition's playlist, because those are all
 * the stream route will serve.
 */
export function masterUris(playlist: string): string[] {
  const out = new Set(masterVariants(playlist));
  for (const { text } of splitLines(playlist)) {
    const t = text.trim();
    if (kindOf(t) !== "tag") continue;
    const attr = uriAttribute(t);
    if (attr) out.add(attr.uri);
  }
  return [...out];
}

/**
 * Every URI in a media playlist the player fetches from storage, once each, in order of first use: the segment lines,
 * the EXT-X-MAP init segments and any EXT-X-KEY. Exactly the set rewriteMedia hands its `sign`, so a caller can sign them
 * all in one request first. A byte-range playlist names one file many times; it's listed once.
 */
export function segmentUris(playlist: string): string[] {
  const out = new Set<string>();
  for (const { text } of splitLines(playlist)) {
    const t = text.trim();
    const kind = kindOf(t);
    if (kind === "uri") out.add(t);
    else if (kind === "tag" && MEDIA_URI_TAGS.has(tagName(t))) {
      const attr = uriAttribute(t);
      if (attr) out.add(attr.uri);
    }
  }
  return [...out];
}

/**
 * The media playlist with every segment URI line and every EXT-X-MAP / EXT-X-KEY URI replaced by `sign(uri)` (asked once
 * per distinct URI). Tags, their other attributes (BYTERANGE, IV, METHOD…), comments, blank lines and line endings stay
 * exactly as they were. A signed value holding a quote or a line break would corrupt the playlist, so it throws instead.
 */
export function rewriteMedia(playlist: string, sign: (uri: string) => string): string {
  const signed = new Map<string, string>();
  const signOnce = (uri: string) => {
    let s = signed.get(uri);
    if (s === undefined) {
      s = sign(uri);
      if (!s || /["\r\n]/.test(s)) throw new Error(`The signed address for ${uri} can't go in a playlist`);
      signed.set(uri, s);
    }
    return s;
  };
  return splitLines(playlist)
    .map(({ text, eol }) => {
      const t = text.trim();
      const kind = kindOf(t);
      if (kind === "uri") return signOnce(t) + eol;
      if (kind === "tag" && MEDIA_URI_TAGS.has(tagName(t))) {
        const attr = uriAttribute(t);
        if (attr) return `${t.slice(0, attr.start)}"${signOnce(attr.uri)}"${t.slice(attr.end)}${eol}`;
      }
      return text + eol;
    })
    .join("");
}

/** A media playlist at a glance: how many segments, how long in all (EXTINF), and whether it's finished (EXT-X-ENDLIST). */
export function mediaSummary(playlist: string): { segments: number; durationSec: number; ended: boolean } {
  let segments = 0;
  let durationSec = 0;
  let ended = false;
  for (const { text } of splitLines(playlist)) {
    const t = text.trim();
    const kind = kindOf(t);
    if (kind === "uri") segments++;
    else if (kind === "tag") {
      const name = tagName(t);
      if (name === "EXT-X-ENDLIST") ended = true;
      else if (name === "EXTINF") {
        const sec = Number.parseFloat(t.slice(t.indexOf(":") + 1));
        if (Number.isFinite(sec) && sec > 0) durationSec += sec;
      }
    }
  }
  return { segments, durationSec: Math.round(durationSec * 1000) / 1000, ended };
}
