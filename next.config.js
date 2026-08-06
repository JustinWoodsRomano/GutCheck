/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  images: { unoptimized: true },
  async redirects() {
    return [
      {
        // The hand-built #55 page has been superseded by the generated route,
        // which covers all 50 codes from one template. Permanent so the
        // indexed URL passes its equity to the new slug rather than 404ing.
        source: "/violations/physical-facilities",
        destination: "/violations/55-physical-facilities-installed-maintained-and-clean",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/data/:path*.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
