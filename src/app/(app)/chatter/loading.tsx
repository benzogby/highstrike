import { HeaderBones, SkeletonPage, TableBones } from "@/components/Skeleton";

// Chatter while it loads: the day's most-talked-about tickers.
export default function Loading() {
  return (
    <SkeletonPage label="chatter">
      <HeaderBones />
      <div className="mt-8">
        <TableBones rows={10} cols={5} />
      </div>
    </SkeletonPage>
  );
}
