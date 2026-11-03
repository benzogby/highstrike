import { Bone, SkeletonPage } from "@/components/Skeleton";
import { CARD } from "@/components/ui";

// An idea while it loads: the way back, the ticker and its tags, the headline, the five figures, then the chart and the
// case on the left with the quick answers and the sizer on the right.
export default function Loading() {
  return (
    <SkeletonPage label="the idea">
      <div className="flex flex-col gap-6">
        <Bone className="h-4 w-14" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Bone className="h-7 w-20" />
            <Bone className="h-5 w-11" />
            <Bone className="h-5 w-14" />
            <Bone className="h-5 w-16" />
          </div>
          <Bone className="mt-4 h-5 w-[36rem] max-w-full" />
          <Bone className="mt-2 h-3.5 w-56" />
        </div>
        <div className={`${CARD} grid grid-cols-2 sm:grid-cols-5`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="px-4 py-3">
              <Bone className="h-3 w-10" />
              <Bone className="mt-2 h-4 w-20" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <div className={`${CARD} p-4`}>
              <Bone className="h-64 w-full rounded-lg" />
            </div>
            <div className={`${CARD} p-4`}>
              <Bone className="h-4 w-24" />
              <Bone className="mt-3 h-3.5 w-full" />
              <Bone className="mt-2 h-3.5 w-4/5" />
            </div>
          </div>
          <div className="flex flex-col gap-6">
            {[0, 1].map((i) => (
              <div key={i} className={`${CARD} p-4`}>
                <Bone className="h-4 w-28" />
                <Bone className="mt-3 h-3.5 w-full" />
                <Bone className="mt-2 h-3.5 w-3/4" />
                <Bone className="mt-2 h-3.5 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
