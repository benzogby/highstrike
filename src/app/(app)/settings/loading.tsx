import { FormBones, HeaderBones, SkeletonPage } from "@/components/Skeleton";

// Settings while it loads: the profile, membership and alerts cards.
export default function Loading() {
  return (
    <SkeletonPage label="settings">
      <HeaderBones />
      <div className="mt-8 space-y-6">
        <FormBones fields={3} />
        <FormBones fields={1} />
      </div>
    </SkeletonPage>
  );
}
