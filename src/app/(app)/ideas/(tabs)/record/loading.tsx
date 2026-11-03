import { Bone, SkeletonPage, TitleBone } from "@/components/Skeleton";
import { CARD } from "@/components/ui";

const WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-3/4", "w-2/5", "w-3/5"];

// The Track record while it loads, under Ideas' header and tabs (the layout's, which stay put): the scoreboard, then a
// day of graded ideas.
export default function Loading() {
  return (
    <SkeletonPage label="the track record">
      <Bone className="mt-5 h-4 w-80 max-w-full" />
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-panel px-4 py-3.5">
            <Bone className="h-3.5 w-20" />
            <Bone className="mt-2.5 h-6 w-14" />
          </div>
        ))}
      </div>
      <TitleBone className="mt-8 w-52" />
      <div className={`${CARD} mt-3 divide-y divide-line`}>
        {WIDTHS.map((w, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Bone className="h-4 w-12" />
            <Bone className="h-4 w-11" />
            <Bone className={`h-3.5 ${w} max-sm:hidden`} />
            <Bone className="ml-auto h-4 w-12" />
            <Bone className="h-4 w-16" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
