import { HeaderBones, SkeletonPage, StatBones, TableBones } from "@/components/Skeleton";

// Any app page without its own placeholder: a title, a row of figures and a table, shown at once while it loads.
export default function Loading() {
  return (
    <SkeletonPage label="page">
      <HeaderBones />
      <div className="mt-8">
        <StatBones />
      </div>
      <div className="mt-8">
        <TableBones />
      </div>
    </SkeletonPage>
  );
}
