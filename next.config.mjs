/** @type {import('next').NextConfig} */
const nextConfig = {
  // react-leaflet's map container isn't safe under React 18 Strict Mode's
  // dev-only double-invoked effects (it throws "Map container is already
  // initialized"), so Strict Mode is off. Doesn't affect production behavior.
  reactStrictMode: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "commons.wikimedia.org" },
    ],
  },
};

export default nextConfig;
