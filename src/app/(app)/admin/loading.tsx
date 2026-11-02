import { SkeletonPage, StatBones, TableBones } from "@/components/Skeleton";

// An Admin tab while it loads, inside Admin's own header and tabs (which stay put).
export default function Loading() {
  return (
    <SkeletonPage label="admin">
      <StatBones />
      <div className="mt-6">
        <TableBones rows={8} cols={5} />
      </div>
    </SkeletonPage>
  );
}
