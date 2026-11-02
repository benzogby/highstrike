import { CARD } from "@/components/ui";
import { Bone, SkeletonPage } from "@/components/Skeleton";

// A lesson while it loads: the player, its title and notes, and the module's lessons beside it.
export default function Loading() {
  return (
    <SkeletonPage label="the lesson">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <Bone className="aspect-video w-full rounded-xl" />
          <Bone className="mt-6 h-6 w-2/3" />
          <Bone className="mt-3 h-4 w-40" />
          <div className="mt-8 space-y-2.5">
            {["w-full", "w-11/12", "w-4/5", "w-full", "w-3/4"].map((w, i) => (
              <Bone key={i} className={`h-3.5 ${w}`} />
            ))}
          </div>
        </div>
        <div className={`${CARD} h-fit p-4`}>
          <Bone className="h-4 w-36" />
          <div className="mt-4 space-y-3.5">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Bone className="h-4 w-4 rounded-full" />
                <Bone className={`h-3.5 ${i % 3 === 0 ? "w-40" : i % 3 === 1 ? "w-32" : "w-44"}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
