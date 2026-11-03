import { Bone, HeaderBones, SkeletonPage } from "@/components/Skeleton";
import { CARD } from "@/components/ui";

const ROWS = ["w-28", "w-36", "w-24", "w-32", "w-20"];

// Watchlists while they load: the title and New list, then a list in its card: name, the add box and its rows.
export default function Loading() {
  return (
    <SkeletonPage label="watchlists">
      <HeaderBones action />
      <Bone className="mt-6 h-3.5 w-64 max-w-full" />
      <div className={`${CARD} mt-3`}>
        <div className="flex items-center gap-3 px-4 pt-4">
          <Bone className="h-5 w-32" />
          <Bone className="h-3.5 w-16" />
          <Bone className="ml-auto h-7 w-16 rounded-md" />
        </div>
        <div className="px-4 pt-3">
          <Bone className="h-10 w-full rounded-lg" />
        </div>
        <div className="mt-3 divide-y divide-line border-t border-line">
          {ROWS.map((w, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1">
                <Bone className="h-4 w-14" />
                <Bone className={`mt-1.5 h-3 ${w}`} />
              </div>
              <Bone className="h-4 w-16" />
              <Bone className="h-4 w-16 max-sm:hidden" />
              <Bone className="h-5 w-16 max-md:hidden" />
              <Bone className="h-7 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
