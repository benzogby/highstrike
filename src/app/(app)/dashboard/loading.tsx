import { Bone, SkeletonPage } from "@/components/Skeleton";

// Home, the trading desk, while it loads: the account bar, the watchlist, the chart and chain, and the ticket.
export default function Loading() {
  return (
    <SkeletonPage label="the trading desk">
      <Bone className="h-16 rounded-xl" />
      <div className="mt-3 grid gap-3 xl:grid-cols-[210px_minmax(0,1fr)_320px]">
        <Bone className="hidden h-[560px] rounded-xl xl:block" />
        <div className="flex flex-col gap-3">
          <Bone className="h-[420px] rounded-xl" />
          <Bone className="h-64 rounded-xl" />
        </div>
        <div className="flex flex-col gap-3">
          <Bone className="h-96 rounded-xl" />
          <Bone className="h-48 rounded-xl" />
        </div>
      </div>
    </SkeletonPage>
  );
}
