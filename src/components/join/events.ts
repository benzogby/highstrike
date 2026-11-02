// How the rest of the site opens the homepage's popup (JoinDialog), kept apart so a button doesn't load the popup itself.

export type JoinIntent = "start" | "login";

/** The event the homepage's buttons send to open the popup (JoinButton). */
export const JOIN_EVENT = "hs:join";

/** The address that opens it on arrival: Google's way back, and the links from the rest of the site. */
export const JOIN_LINK = "/?join=1";
