import { GET as asset } from "../asset/[slot]/route";

export const dynamic = "force-dynamic";

// The old favicon address (bookmarks and cached pages still ask for it): the same as /api/site/asset/favicon.
export function GET(request: Request) {
  return asset(request, { params: Promise.resolve({ slot: "favicon" }) });
}
