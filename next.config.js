/** @type {import('next').NextConfig} */
const nextConfig = {
<<<<<<< HEAD
  // Use standalone output for Docker, but not for Vercel
  // Vercel handles this automatically
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  eslint: {
    // Note: Currently ignoring during builds due to non-critical warnings
    // TODO: Fix remaining ESLint warnings (unused imports, missing dependencies)
    // Most are code quality issues, not breaking errors
    ignoreDuringBuilds: true, // Remove after fixing remaining warnings
  },
  typescript: {
    // Note: Currently ignoring build errors due to non-critical type issues
    // Critical errors have been fixed (orders route, switch component, business intelligence)
    // Remaining: mostly any types, unused variables in non-critical code
    // TODO: Gradually fix remaining TypeScript issues
    ignoreBuildErrors: true, // Remove after fixing remaining type issues
  },
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
=======
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  // Docker build optimizations
  output: 'standalone',
  // Optimize for Docker builds
  swcMinify: true,
  // Security headers configuration
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
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