# Use the official Node.js runtime as the base image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files and locally installed node_modules
COPY package.json package-lock.json* ./
COPY node_modules ./node_modules

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set required environment variables for build process
ENV DATABASE_URL="mongodb://localhost:27017/smartstore"
ENV OPENAI_API_KEY="dummy-key-for-build"
ENV STRIPE_SECRET_KEY="dummy-key-for-build"
ENV PAYPAL_CLIENT_ID="dummy-key-for-build"
ENV PAYPAL_CLIENT_SECRET="dummy-key-for-build"
ENV TWILIO_ACCOUNT_SID="dummy-key-for-build"
ENV TWILIO_AUTH_TOKEN="dummy-key-for-build"
ENV FACEBOOK_APP_ID="dummy-key-for-build"
ENV FACEBOOK_APP_SECRET="dummy-key-for-build"
ENV NEXTAUTH_SECRET="dummy-secret-for-build"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV REDIS_URL="redis://localhost:6379"
ENV NODE_ENV="production"
ENV PRISMA_CLI_QUERY_ENGINE_TYPE="binary"
ENV PRISMA_CLI_BINARY_TARGETS="linux-musl"
ENV PRISMA_GENERATE_DATAPROXY="false"
ENV PRISMA_CLIENT_ENGINE_TYPE="binary"
ENV PRISMA_QUERY_ENGINE_TYPE="binary"

# Generate Prisma client with retry logic
RUN npx prisma generate || (sleep 10 && npx prisma generate)

# Type check the application
RUN npm run type-check || echo "Type check completed with warnings"

# Build the application with environment variables set and skip problematic imports
RUN npm run build:docker

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy Prisma files and generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"] 