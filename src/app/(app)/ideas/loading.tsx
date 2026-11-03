import { CardBones, HeaderBones, SkeletonPage, StatBones, TitleBone } from "@/components/Skeleton";

// Ideas while it loads: the filters, then the ideas by day.
export default function Loading() {
  return (
    <SkeletonPage label="ideas">
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
