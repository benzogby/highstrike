// The site's images an admin sets in Admin → Site → Images (Ben, 2026-11-18: "Allow me to set app favicon and logo,
// and all other required images, in the admin panel under Site"). Each is a site_settings row holding the uploaded
// file's public URL (bucket site-assets); unset, the built-in file is used. Pages point at /api/site/asset/<key>, which
// redirects to whichever is current, so a new upload shows without a deploy (within ~5 minutes, the redirect's cache).

export type SiteImage = { key: string; title: string; hint: string; fallback: string; wide?: boolean; maskNote?: boolean };

export const SITE_IMAGES: SiteImage[] = [
  {
    key: "favicon",
    title: "Favicon",
    hint: "The browser-tab icon. Square PNG or SVG, 64×64 or larger.",
    fallback: "/app-icons/icon-192.png",
  },
  {
    key: "app_icon",
    title: "App icon",
    hint: "The icon when HighStrike is added to a phone's home screen, and in the install prompt. Square PNG, 512×512, no transparency.",
    fallback: "/app-icons/icon-512.png",
  },
  {
    key: "logo",
    title: "App logo",
    hint: "In the app's sidebar and top bar, on the dark background. PNG or SVG with transparency, wide (about 4:1). Unset, the built-in mark shows.",
    fallback: "",
    wide: true,
  },
  {
    key: "wordmark",
    title: "Homepage wordmark",
    hint: "The \"HighStrike\" name in the homepage's top bar and footer. Light PNG or SVG with transparency, about 5:1.",
    fallback: "/brand/wordmark.png",
    wide: true,
  },
  {
    key: "mark",
    title: "Homepage mark",
    hint: "The bull beside the homepage's name. Square PNG or SVG with transparency: only its shape is used, drawn in HighStrike green.",
    fallback: "/brand/mark.png",
    maskNote: true,
  },
  {
    key: "og_image",
    title: "Social share image",
    hint: "The picture when a link to HighStrike is shared (texts, X, Facebook, Slack). 1200×630 PNG or JPG.",
    fallback: "/app-icons/icon-512.png",
    wide: true,
  },
];

export const SITE_IMAGE_KEYS = SITE_IMAGES.map((i) => i.key);

/** The stable URL that always shows an image's current version. */
export const siteImage = (key: string) => `/api/site/asset/${key}`;
