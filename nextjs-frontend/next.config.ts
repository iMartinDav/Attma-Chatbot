/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: false, // Temporarily disabled to debug multiple mounting
  // Next.js telemetry is disabled via NEXT_TELEMETRY_DISABLED environment variable
  experimental: {
    ppr: false,
    // Add large response support if needed
    largePageDataBytes: 300 * 1024 * 1024, // Equivalent to 300MB
  },
  images: {
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
