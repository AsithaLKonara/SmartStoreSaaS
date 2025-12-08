/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output for Docker, but not for Vercel
  // Vercel handles this automatically
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  eslint: {
    // ESLint errors have been fixed
    ignoreDuringBuilds: false,
  },
  typescript: {
    // TypeScript errors have been fixed
    ignoreBuildErrors: false,
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  // Optimize for Docker builds
  swcMinify: true,
  images: {
    domains: [
      'localhost',
      'smartstore-ai.vercel.app',
      'res.cloudinary.com',
      'lh3.googleusercontent.com',
      'graph.facebook.com',
    ],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' 'inline-speculation-rules'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
              "block-all-mixed-content",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  // Webpack configuration to handle Prisma during build
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev) {
      // Exclude Prisma from server-side build to prevent initialization issues
      config.externals = config.externals || [];
      config.externals.push('@prisma/client');
    }
    return config;
  },
}

module.exports = nextConfig 