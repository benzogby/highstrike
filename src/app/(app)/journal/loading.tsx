import { HeaderBones, SkeletonPage, StatBones, TableBones } from "@/components/Skeleton";

// My trades while it loads: the record, then the open trades.
export default function Loading() {
  return (
    <SkeletonPage label="your trades">
      <HeaderBones action />
      <div className="mt-8">
        <StatBones count={4} />
      </div>
      <div className="mt-8">
        <TableBones rows={5} cols={4} />
      </div>
    </SkeletonPage>
  );
}
