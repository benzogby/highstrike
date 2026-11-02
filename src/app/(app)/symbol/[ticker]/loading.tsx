import { CARD } from "@/components/ui";
import { Bone, HeaderBones, SkeletonPage, TableBones, TitleBone } from "@/components/Skeleton";

// A symbol while it loads: its name and price, the chart, then its news and filings.
export default function Loading() {
  return (
    <SkeletonPage label="the symbol">
      <HeaderBones action />
      <div className={`mt-6 ${CARD} p-5`}>
        <div className="flex items-center justify-between">
          <Bone className="h-5 w-32" />
          <Bone className="h-7 w-40 rounded-lg" />
        </div>
        <Bone className="mt-5 h-64 w-full rounded-lg" />
      </div>
      <TitleBone className="mt-10" />
      <div className="mt-3">
        <TableBones rows={5} cols={4} />
      </div>
    </SkeletonPage>
  );
}
