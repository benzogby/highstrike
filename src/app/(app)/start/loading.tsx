import { Bone, SkeletonPage } from "@/components/Skeleton";

// /start while the profile loads: the question's heading and its choices.
export default function Loading() {
  return (
    <SkeletonPage label="your first questions">
      <div className="mx-auto max-w-xl py-10">
        <Bone className="h-4 w-24" />
        <Bone className="mt-4 h-8 w-80 max-w-full" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
