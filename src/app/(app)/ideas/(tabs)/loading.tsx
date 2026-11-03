import { Bone, SkeletonPage, TitleBone } from "@/components/Skeleton";
import { CARD } from "@/components/ui";

const WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-3/4", "w-2/5", "w-3/5"];

// The feed while it loads, under Ideas' header and tabs (the layout's, which stay put): the filters, then a day of ideas.
export default function Loading() {
  return (
    <SkeletonPage label="ideas">
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Bone className="h-9 w-40 rounded-lg" />
        <Bone className="h-7 w-36" />
        <Bone className="h-7 w-52 max-sm:hidden" />
      </div>
      <Bone className="mt-3 h-7 w-full max-w-xl" />
      <TitleBone className="mt-8 w-52" />
      <div className={`${CARD} mt-3 divide-y divide-line`}>
        {WIDTHS.map((w, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Bone className="h-4 w-12" />
            <Bone className="h-4 w-11" />
            <Bone className={`h-3.5 ${w}`} />
            <Bone className="ml-auto h-4 w-16 max-sm:hidden" />
            <Bone className="h-4 w-14" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
