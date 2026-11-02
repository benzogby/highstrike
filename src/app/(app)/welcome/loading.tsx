import { Bone, SkeletonPage } from "@/components/Skeleton";

// /welcome while the payment is confirmed: the check's place, the heading and its lines.
export default function Loading() {
  return (
    <SkeletonPage label="your account">
      <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
        <Bone className="size-14 rounded-full" />
        <Bone className="mt-5 h-8 w-40" />
        <Bone className="mt-4 h-4 w-80 max-w-full" />
        <Bone className="mt-2 h-4 w-64 max-w-full" />
      </div>
    </SkeletonPage>
  );
}
