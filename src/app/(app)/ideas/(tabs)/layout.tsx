import Link from "next/link";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, PageHeader } from "@/components/ui";
import IdeasTabs from "./IdeasTabs";

/**
 * Ideas' two tabs (Ben, 2026-11-03: Setups merged into Ideas): today's feed at /ideas and the Track record at
 * /ideas/record, real URLs under one header. The header and tabs stay put while a tab changes; only the part under them
 * shows its loading skeleton. Each page checks membership itself (requireMember), since a layout can't stop a page.
 */
export default function IdeasTabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        className="anim-rise"
        title="Ideas"
        subtitle="Every trade idea in one place, and how each one turned out. Open one for the bull and bear case, quick answers and sizing."
        actions={
          <>
            <Link href="/ideas/build" className={BUTTON_SECONDARY}>
              Build an idea
            </Link>
            <Link href="/ideas/paste" className={BUTTON_PRIMARY}>
              Paste an idea
            </Link>
          </>
        }
      />
      <IdeasTabs />
      {children}
    </>
  );
}
