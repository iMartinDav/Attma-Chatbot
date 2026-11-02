/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The rare-disease engine reads its HPO index from disk at runtime.
  outputFileTracingIncludes: {
    '/api/chat': ['./lib/rare-disease/data/*.json'],
  },
  reactStrictMode: true,
  experimental: {
    ppr: false,
  },
  images: {
    qualities: [75, 100],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatar.vercel.sh',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.gravatar.com',
        pathname: '/avatar/**',
      },
    ],
  },
};

export default nextConfig;
