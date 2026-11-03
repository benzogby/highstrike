/** The account's picture, or its initials on the green tint. */
export default function Avatar({ name, url, size = 28 }: { name: string; url?: string | null; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" style={{ width: size, height: size }} className="flex-none rounded-full border border-line object-cover" />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="flex flex-none items-center justify-center rounded-full bg-accent-soft text-xs font-medium uppercase text-accent-ink ring-1 ring-inset ring-accent/25"
    >
      {name.slice(0, 2)}
    </span>
  );
}
