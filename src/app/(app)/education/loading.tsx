import { CardBones, HeaderBones, SkeletonPage } from "@/components/Skeleton";

// Trading School while it loads: the module cards.
export default function Loading() {
  return (
    <SkeletonPage label="Trading School">
      <div className="mx-auto max-w-6xl">
        <HeaderBones />
        <div className="mt-8">
          <CardBones count={6} columns="md:grid-cols-2 lg:grid-cols-3" />
        </div>
      </div>
    </SkeletonPage>
  );
}
