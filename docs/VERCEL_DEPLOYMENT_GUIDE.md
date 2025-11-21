# Vercel Deployment Guide

## 🚀 Quick Start

### Option 1: Using Script (Recommended)
```bash
# Preview deployment
npm run deploy:vercel

# Production deployment
npm run deploy:vercel:prod
```

### Option 2: Using Vercel CLI
```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Option 3: Using Vercel Dashboard
1. Connect your GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push

---

## 📋 Prerequisites

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Required Environment Variables

Set these in Vercel dashboard or via CLI:

#### Required
- `DATABASE_URL` - MongoDB connection string
- `NEXTAUTH_SECRET` - Random secret for NextAuth
- `NEXTAUTH_URL` - Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

#### Recommended
- `NODE_ENV` - Set to `production`
- `NEXT_PUBLIC_APP_URL` - Your public app URL
- `REDIS_URL` - Redis connection string (if using Redis)
- `GOOGLE_CLIENT_ID` - For Google OAuth
- `GOOGLE_CLIENT_SECRET` - For Google OAuth

#### Optional
- `STRIPE_SECRET_KEY` - For payments
- `TWILIO_ACCOUNT_SID` - For WhatsApp/SMS
- `OPENAI_API_KEY` - For AI features
- Other service API keys

---

## 🔧 Setting Environment Variables

### Via Vercel Dashboard
1. Go to your project in Vercel dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable for:
   - **Production**
   - **Preview**
   - **Development** (optional)

### Via Vercel CLI
```bash
# Add environment variable
vercel env add DATABASE_URL production

# List environment variables
vercel env ls

# Remove environment variable
vercel env rm DATABASE_URL production
```

---

## 🗄️ Database Setup

### MongoDB Atlas (Recommended for Vercel)

1. **Create MongoDB Atlas Account**
   - Go to https://www.mongodb.com/cloud/atlas
   - Create a free cluster

2. **Get Connection String**
   - Go to **Database** → **Connect**
   - Choose **Connect your application**
   - Copy connection string
   - Replace `<password>` with your password

3. **Set DATABASE_URL**
   ```bash
   vercel env add DATABASE_URL production
   # Paste: mongodb+srv://username:password@cluster.mongodb.net/smartstore?retryWrites=true&w=majority
   ```

4. **Run Migrations**
   ```bash
   # Set DATABASE_URL locally
   export DATABASE_URL="your-mongodb-connection-string"
   
   # Run migrations
   npx prisma migrate deploy
   # or
   npx prisma db push
   ```

### Alternative: MongoDB on Railway/Heroku
- Use Railway MongoDB addon
- Use Heroku MongoDB addon
- Use any MongoDB hosting service

---

## 🔄 Database Migrations on Vercel

### Option 1: Build-time Migration (Recommended)
Vercel runs the build command which includes Prisma generation:

```json
{
  "buildCommand": "prisma generate && next build"
}
```

**Note**: For migrations, you need to run them separately:

```bash
# After deployment, run migrations
vercel env pull .env.local
npx prisma migrate deploy
```

### Option 2: Post-Deploy Hook
Create a Vercel serverless function to run migrations:

```typescript
// api/migrate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  // Add authentication check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.MIGRATION_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await execAsync('npx prisma migrate deploy');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

Then call it after deployment:
```bash
curl -X POST https://your-app.vercel.app/api/migrate \
  -H "Authorization: Bearer YOUR_MIGRATION_SECRET"
```

---

## 📦 Build Configuration

### vercel.json
The project includes a `vercel.json` file with:
- Build command: `prisma generate && next build`
- API function timeout: 30 seconds
- CORS headers configuration
- Framework detection

### Next.js Config
The `next.config.js` automatically:
- Uses standalone output for Docker (not Vercel)
- Configures image domains
- Sets up CORS headers
- Handles webpack fallbacks

---

## 🚀 Deployment Steps

### First Time Deployment

1. **Install and Login**
   ```bash
   npm i -g vercel
   vercel login
   ```

2. **Set Environment Variables**
   ```bash
   vercel env add DATABASE_URL production
   vercel env add NEXTAUTH_SECRET production
   vercel env add NEXTAUTH_URL production
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Update NEXTAUTH_URL**
   After first deployment, update `NEXTAUTH_URL` with your actual Vercel URL:
   ```bash
   vercel env rm NEXTAUTH_URL production
   vercel env add NEXTAUTH_URL production
   # Enter: https://your-app.vercel.app
   ```

5. **Run Database Migrations**
   ```bash
   export DATABASE_URL="your-production-database-url"
   npx prisma migrate deploy
   ```

### Subsequent Deployments

```bash
# Preview (automatic on git push)
git push

# Production
vercel --prod

# Or use script
npm run deploy:vercel:prod
```

---

## 🔍 Verification

After deployment:

1. **Check Health Endpoint**
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

2. **Check Database Connection**
   - Visit your app
   - Try to sign in
   - Check Vercel logs for errors

3. **Check Environment Variables**
   ```bash
   vercel env ls
   ```

---

## 📊 Monitoring

### Vercel Dashboard
- **Deployments**: View all deployments
- **Logs**: Real-time and historical logs
- **Analytics**: Performance metrics
- **Functions**: Serverless function logs

### Useful Commands
```bash
# View logs
vercel logs

# Inspect deployment
vercel inspect

# List deployments
vercel ls

# View environment variables
vercel env ls
```

---

## 🐛 Troubleshooting

### Build Fails

**Error**: `Prisma Client has not been generated`
**Solution**: The build command includes `prisma generate`, but if it fails:
```bash
# Check DATABASE_URL is set
vercel env ls

# Try building locally first
npm run build
```

**Error**: `Module not found`
**Solution**: Check all dependencies are in `package.json`:
```bash
npm install
npm run build
```

### Database Connection Fails

**Error**: `Can't reach database server`
**Solution**:
1. Check `DATABASE_URL` is correct
2. Check MongoDB Atlas IP whitelist (allow `0.0.0.0/0` for Vercel)
3. Check database credentials

### Migration Fails

**Error**: `Migration failed`
**Solution**:
1. Run migrations locally first:
   ```bash
   export DATABASE_URL="your-db-url"
   npx prisma migrate deploy
   ```
2. Check Prisma schema is valid:
   ```bash
   npx prisma validate
   ```

### NextAuth Not Working

**Error**: `Invalid credentials`
**Solution**:
1. Check `NEXTAUTH_SECRET` is set
2. Check `NEXTAUTH_URL` matches your Vercel URL
3. Check callback URLs in OAuth providers

---

## 🔐 Security Best Practices

1. **Never commit `.env` files**
   - Already in `.gitignore`
   - Use Vercel environment variables

2. **Use strong secrets**
   ```bash
   # Generate NEXTAUTH_SECRET
   openssl rand -base64 32
   ```

3. **Restrict MongoDB access**
   - Use MongoDB Atlas IP whitelist
   - Use database user with minimal permissions

4. **Enable Vercel Protection**
   - Enable DDoS protection
   - Enable rate limiting
   - Use Vercel Edge Functions for sensitive operations

---

## 📈 Performance Optimization

### Vercel Features
- **Edge Network**: Automatic CDN
- **Image Optimization**: Automatic via Next.js Image component
- **Serverless Functions**: Automatic scaling
- **ISR**: Incremental Static Regeneration

### Recommendations
1. Use `next/image` for images
2. Enable ISR for static pages
3. Use API routes for dynamic content
4. Optimize bundle size
5. Use Vercel Analytics

---

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://nextjs.org/docs/deployment)
- [Prisma on Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

---

## ✅ Deployment Checklist

- [ ] Vercel CLI installed and logged in
- [ ] Environment variables set in Vercel
- [ ] Database configured (MongoDB Atlas recommended)
- [ ] Database migrations run
- [ ] Build succeeds locally
- [ ] Deployed to preview
- [ ] Health endpoint works
- [ ] Database connection verified
- [ ] Authentication tested
- [ ] Deployed to production
- [ ] Production URL updated in environment variables
- [ ] Monitoring set up

---

**Ready to deploy!** 🚀

Run: `npm run deploy:vercel:prod`

