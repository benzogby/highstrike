import { HeaderBones, SkeletonPage, TableBones } from "@/components/Skeleton";

// The scanner while it loads: its ranked table.
export default function Loading() {
  return (
    <SkeletonPage label="the scanner">
      <HeaderBones />
      <div className="mt-8">
        <TableBones rows={12} cols={7} />
      </div>
    </SkeletonPage>
  );
}
