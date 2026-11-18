"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_ZONE, cleanZone } from "./zone";

const never = () => () => {};

/** The viewer's own time zone in the browser (New York while the server draws the page). */
export function useZone(): string {
  return useSyncExternalStore(never, () => cleanZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? DEFAULT_ZONE, () => DEFAULT_ZONE);
}
