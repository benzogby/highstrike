"use client";

import { useState, type RefObject } from "react";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/kit/button";
import { Input } from "@/components/kit/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/kit/popover";
import { searchFromOptions } from "@/lib/inbox-mail";
import { useMailbox } from "./context";

/**
 * Gmail's search box: any Gmail search (from:, has:attachment, older_than:, label:, deliveredto: …) goes straight to Gmail,
 * and the sliders open Gmail's search options. "/" puts the cursor here; Escape leaves it.
 */

function Options({ onSearch }: { onSearch: (q: string) => void }) {
  const [o, setO] = useState({ from: "", to: "", subject: "", words: "", without: "", attachment: false, after: "", before: "" });
  const field = (key: "from" | "to" | "subject" | "words" | "without", label: string) => (
    <label className="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm">
      <span className="text-ink-3">{label}</span>
      <Input value={o[key]} onChange={(e) => setO({ ...o, [key]: e.target.value })} />
    </label>
  );
  const q = searchFromOptions(o);
  return (
    <form className="grid gap-2.5" onSubmit={(e) => { e.preventDefault(); if (q) onSearch(q); }}>
      {field("from", "From")}
      {field("to", "To")}
      {field("subject", "Subject")}
      {field("words", "Has the words")}
      {field("without", "Doesn't have")}
      <label className="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm">
        <span className="text-ink-3">Date</span>
        <span className="flex items-center gap-1.5">
          <Input type="date" aria-label="After" value={o.after} onChange={(e) => setO({ ...o, after: e.target.value })} />
          <span className="text-ink-3">to</span>
          <Input type="date" aria-label="Before" value={o.before} onChange={(e) => setO({ ...o, before: e.target.value })} />
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-accent" checked={o.attachment} onChange={(e) => setO({ ...o, attachment: e.target.checked })} />Has attachment</label>
      <div className="flex justify-end pt-1"><Button type="submit" disabled={!q}>Search</Button></div>
    </form>
  );
}

function Box({ initial, inputRef }: { initial: string; inputRef: RefObject<HTMLInputElement | null> }) {
  const { go } = useMailbox();
  const [text, setText] = useState(initial);
  const [opts, setOpts] = useState(false);
  const search = (q: string) => {
    setOpts(false);
    go(q.trim() ? { view: { kind: "search", q: q.trim() }, thread: null, page: 1 } : { view: { kind: "system", key: "inbox" }, thread: null, page: 1 });
    inputRef.current?.blur();
  };
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); search(text); }}
      className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-full bg-panel-2 pl-3 pr-1 transition-colors focus-within:bg-panel focus-within:shadow-sm focus-within:ring-1 focus-within:ring-line-strong md:max-w-3xl">
      <button type="submit" aria-label="Search mail" className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-panel-3"><SearchIcon className="size-4.5" /></button>
      <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Search mail" aria-label="Search mail"
        onKeyDown={(e) => { if (e.key === "Escape") { e.currentTarget.blur(); setText(initial); } }}
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
      {text && <button type="button" aria-label="Clear search" onClick={() => { setText(""); if (initial) search(""); }} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-panel-3"><XIcon className="size-4" /></button>}
      <Popover open={opts} onOpenChange={setOpts}>
        <PopoverTrigger render={<button type="button" aria-label="Show search options" title="Show search options" className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-panel-3" />}>
          <SlidersHorizontalIcon className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(34rem,calc(100vw-2rem))] p-4">{opts && <Options onSearch={search} />}</PopoverContent>
      </Popover>
    </form>
  );
}

export function SearchBar({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const { route } = useMailbox();
  const current = route.view.kind === "search" ? route.view.q : "";
  return <Box key={current} initial={current} inputRef={inputRef} />;
}
