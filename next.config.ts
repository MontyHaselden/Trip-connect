import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  async redirects() {
    return [
      {
        source: "/host",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/dashboard-legacy",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/dashboard-legacy/:path*",
        destination: "/dashboard/:path*",
        permanent: true,
      },
      {
        source: "/join/:inviteCode",
        destination: "/s/:inviteCode",
        permanent: true,
      },
      {
        source: "/mobile/join/:inviteCode",
        destination: "/s/:inviteCode",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
