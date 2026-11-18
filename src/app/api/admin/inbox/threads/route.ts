import { rateGuard } from "@/features/inbox/platform";
import { EMAIL, MAILBOX_DOMAIN, SYSTEM_VIEWS, listParams, type SystemView } from "@/lib/inbox-mail";
import { isLabelId, listDrafts, listThreads } from "@/features/inbox/gmail";
import { jsonRoute } from "@/features/inbox/route-kit";

export const dynamic = "force-dynamic";

const SYSTEM = new Set<string>(SYSTEM_VIEWS.map((v) => v.key));
const PAGE_TOKEN = /^[A-Za-z0-9_-]{1,256}$/;

/**
 * GET: one page of an Admin → Inbox list. `view` a folder (inbox, sent, …), or `label` a label's id, `addr` one of the
 * mailbox's addresses, `q` a Gmail search; `page` the token of the page after the last one read.
 */
export async function GET(request: Request) {
  const tooMany = await rateGuard(request, "/api/admin/inbox/threads");
  if (tooMany) return tooMany;
  return jsonRoute("/api/admin/inbox/threads", async () => {
    const sp = new URL(request.url).searchParams;
    const view = sp.get("view");
    const page = sp.get("page");
    const token = page && PAGE_TOKEN.test(page) ? page : null;
    if (view === "drafts") return listDrafts(token);
    const label = sp.get("label");
    const addr = sp.get("addr")?.toLowerCase() ?? null;
    const params = listParams({
      system: view && SYSTEM.has(view) ? (view as SystemView) : null,
      labelId: isLabelId(label) ? label : null,
      addr: addr && EMAIL.test(addr) && addr.endsWith(`@${MAILBOX_DOMAIN}`) ? addr : null,
      q: sp.get("q")?.slice(0, 500) ?? null,
    });
    return listThreads({ ...params, pageToken: token });
  });
}
