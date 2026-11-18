import { Bone, SkeletonPage } from "@/components/Skeleton";

// /start/idea while today's ideas are sized: the heading, the chart and the size card.
export default function Loading() {
  return (
    <SkeletonPage label="your first idea">
      <Bone className="h-4 w-32" />
      <Bone className="mt-4 h-8 w-96 max-w-full" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Bone className="h-[420px] rounded-xl" />
        <Bone className="h-[420px] rounded-xl" />
      </div>
    </SkeletonPage>
  );
}
