import { Bone, HeaderBones, SkeletonPage, TableBones } from "@/components/Skeleton";

// The insider feed while it loads: the cluster chips, then the filings.
export default function Loading() {
  return (
    <SkeletonPage label="the insider feed">
      <HeaderBones />
      <div className="mt-6 flex flex-wrap gap-3">
        {[0, 1, 2].map((i) => (
          <Bone key={i} className="h-12 w-56 rounded-xl" />
        ))}
      </div>
      <div className="mt-6">
        <TableBones rows={10} cols={6} />
      </div>
    </SkeletonPage>
  );
}
