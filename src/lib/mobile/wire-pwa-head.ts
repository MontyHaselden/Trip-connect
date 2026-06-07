export function buildTripManifestHref(tripName: string, startUrl: string) {
  return `/api/manifest?name=${encodeURIComponent(tripName)}&startUrl=${encodeURIComponent(startUrl)}`;
}

export function wirePwaHead(options: {
  manifestHref: string;
  appTitle: string;
}) {
  if (typeof document === "undefined") return;

  const { manifestHref, appTitle } = options;

  let manifestLink = document.querySelector<HTMLLinkElement>(
    'link[rel="manifest"]',
  );
  if (manifestLink) {
    manifestLink.href = manifestHref;
  } else {
    manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    manifestLink.href = manifestHref;
    document.head.appendChild(manifestLink);
  }

  const metaTags: Array<[string, string]> = [
    ["apple-mobile-web-app-capable", "yes"],
    ["apple-mobile-web-app-title", appTitle],
    ["apple-mobile-web-app-status-bar-style", "default"],
    ["mobile-web-app-capable", "yes"],
  ];

  for (const [name, content] of metaTags) {
    let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (meta) {
      meta.content = content;
    } else {
      meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
    }
  }

  let appleIcon = document.querySelector<HTMLLinkElement>(
    'link[rel="apple-touch-icon"]',
  );
  if (!appleIcon) {
    appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    appleIcon.href = "/icon-192.png";
    document.head.appendChild(appleIcon);
  }
}
