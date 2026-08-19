export const metadata = {
  title: "Site — Admin — HighStrike",
};

export default function AdminSitePage() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-panel px-6 py-16 text-center">
      <p className="font-display text-lg font-semibold">Site</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-2">
        This tab will be built to match the zogby.io admin Site tab exactly.
        Waiting on access to that implementation as its reference — nothing here
        is guessed in the meantime.
      </p>
    </div>
  );
}
