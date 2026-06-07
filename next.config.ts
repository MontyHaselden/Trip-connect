import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/host",
        destination: "/dashboard",
        permanent: false,
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
