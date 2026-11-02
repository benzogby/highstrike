import { CardBones, HeaderBones, SkeletonPage, StatBones, TableBones, TitleBone } from "@/components/Skeleton";

// Home while it loads: the greeting, the weather's three gauges, today's setups and the watchlist.
export default function Loading() {
  return (
    <SkeletonPage label="home">
      <HeaderBones />
      <TitleBone className="mt-8" />
      <div className="mt-3">
        <StatBones count={3} tall />
      </div>
      <TitleBone className="mt-10" />
      <div className="mt-3">
        <CardBones count={3} />
      </div>
      <TitleBone className="mt-10" />
      <div className="mt-3">
        <TableBones rows={5} />
      </div>
    </SkeletonPage>
  );
}
