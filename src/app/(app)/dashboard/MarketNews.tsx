import { fetchMarketNews, newsTime } from "@/lib/news";
import { Bone } from "@/components/Skeleton";

/** The day's headlines, streamed in after the rest of Home so a slow news feed never holds the page. */
export default async function MarketNews() {
  const marketNews = await fetchMarketNews();
  if (marketNews.items.length === 0) return null;
  return (
    <>
      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-display text-[15px] text-ink">Market news</h2>
        <span className="text-xs text-ink-3 font-medium">Live headlines</span>
      </div>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-panel">
        {marketNews.items.map((n) => (
          <li key={n.url}>
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="block px-5 py-3 transition hover:bg-panel-2">
              <p className="text-sm text-ink">{n.headline}</p>
              <p className="mt-0.5 text-xs text-ink-3">
                {n.source} · {newsTime(n.datetime)}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The headlines' place while they load. */
export function MarketNewsBones() {
  return (
    <div className="mt-8" aria-hidden="true">
      <Bone className="h-4 w-28" />
      <div className="mt-3 divide-y divide-line rounded-xl border border-line bg-panel">
        {["w-full", "w-11/12", "w-4/5", "w-full"].map((w, i) => (
          <div key={i} className="px-5 py-3">
            <Bone className={`h-3.5 ${w}`} />
            <Bone className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
