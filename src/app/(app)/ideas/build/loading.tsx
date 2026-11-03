import { Bone, HeaderBones, SkeletonPage } from "@/components/Skeleton";
import { CARD } from "@/components/ui";

// Build an idea while it loads: the way back, the title with the Paste/Build switch, the choices, and the results' place.
export default function Loading() {
  return (
    <SkeletonPage label="build an idea">
      <div className="flex flex-col gap-6">
        <Bone className="h-4 w-14" />
        <HeaderBones action />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className={`${CARD} flex flex-col gap-4 p-4`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i}>
                <Bone className="h-3.5 w-24" />
                <div className="mt-2 flex gap-1.5">
                  <Bone className="h-8 w-16 rounded-md" />
                  <Bone className="h-8 w-20 rounded-md" />
                  <Bone className="h-8 w-16 rounded-md" />
                </div>
              </div>
            ))}
            <Bone className="h-9 w-full rounded-lg" />
          </div>
          <div className={`${CARD} h-32 max-lg:hidden`} />
        </div>
      </div>
    </SkeletonPage>
  );
}
