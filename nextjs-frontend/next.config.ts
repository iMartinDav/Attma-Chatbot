/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    ppr: false,
    serverActions: {
      bodySizeLimit: '300mb', // Add this for Server Actions
    },
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
  // Increase bodyParser limit for API routes to handle large files
  api: {
    bodyParser: {
      sizeLimit: '300mb',
    },
    responseLimit: false,
  },
};

export default nextConfig;
