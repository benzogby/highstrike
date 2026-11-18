import { Bone, HeaderBones, SkeletonPage } from "@/components/Skeleton";

// /plan while the stock's prices and earnings date load: the header, the chart and the plan's cards.
export default function Loading() {
  return (
    <SkeletonPage label="the Trade Planner">
      <HeaderBones action />
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Bone className="h-[460px] rounded-xl" />
        <div className="flex flex-col gap-6">
          <Bone className="h-60 rounded-xl" />
          <Bone className="h-48 rounded-xl" />
        </div>
      </div>
    </SkeletonPage>
  );
}
