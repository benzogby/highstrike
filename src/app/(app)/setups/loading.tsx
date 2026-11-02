import { CardBones, HeaderBones, SkeletonPage, StatBones, TitleBone } from "@/components/Skeleton";

// Setups while it loads: the scoreboard, then the setup cards by day.
export default function Loading() {
  return (
    <SkeletonPage label="setups">
      <HeaderBones />
      <div className="mt-8">
        <StatBones />
      </div>
      <TitleBone className="mt-10" />
      <div className="mt-3">
        <CardBones count={6} />
      </div>
    </SkeletonPage>
  );
}
