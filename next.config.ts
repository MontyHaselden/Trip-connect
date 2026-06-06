import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/host",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
