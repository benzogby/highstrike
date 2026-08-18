import type { MetadataRoute } from "next";
import { posts } from "@/lib/posts";

const BASE = "https://highstrike-one.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/results", "/pricing", "/blog", "/about", "/company"].map(
    (path) => ({
      url: `${BASE}${path}`,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })
  );
  const postUrls = posts.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: new Date(`${p.date}T00:00:00Z`),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
  return [...pages, ...postUrls];
}
