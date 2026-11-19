import { Bone, HeaderBones, SkeletonPage } from "@/components/Skeleton";

// /strategies while it loads: the header and the editor.
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
