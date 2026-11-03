import { Bone, HeaderBones, SkeletonPage } from "@/components/Skeleton";
import { CARD } from "@/components/ui";

// Paste an idea while it loads: the way back, the title with the Paste/Build switch, then the box to paste into.
export default function Loading() {
  return (
    <SkeletonPage label="paste an idea">
      <div className="flex flex-col gap-6">
        <Bone className="h-4 w-14" />
        <HeaderBones action />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={`${CARD} p-4`}>
            <Bone className="h-3.5 w-24" />
            <Bone className="mt-2 h-40 w-full rounded-lg" />
            <div className="mt-3 flex gap-2">
              <Bone className="h-9 w-24 rounded-lg" />
              <Bone className="h-9 w-32 rounded-lg" />
            </div>
            <Bone className="mt-3 h-3.5 w-4/5" />
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
