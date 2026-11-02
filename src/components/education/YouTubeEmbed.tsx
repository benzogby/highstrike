/** A lesson's YouTube video, as Whop showed it: YouTube's own player, on its privacy-enhanced domain. */
export default function YouTubeEmbed({ id, title }: { id: string; title: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
