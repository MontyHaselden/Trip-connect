import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name")?.trim() || "Trip Connect";
  const shortName =
    url.searchParams.get("shortName")?.trim() ||
    (name.length > 12 ? `${name.slice(0, 12)}…` : name);
  const startUrl = url.searchParams.get("startUrl")?.trim() || "/app/today";

  const manifest = {
    id: "/",
    name,
    short_name: shortName,
    description: "School trip booklet and admin.",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#fafafa",
    theme_color: "#18181b",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-cache",
    },
  });
}
