# Git-Based Vercel Deployment Guide

## 🌿 Overview

Vercel integrates seamlessly with Git repositories (GitHub, GitLab, Bitbucket) to provide **automatic deployments** on every push. This is the recommended deployment method.

---

## 🚀 Git-Based Deployment Options

### Option 1: Automatic GitHub Integration (Recommended) ⭐

**Best for**: Most users, automatic deployments

1. **Connect Repository to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click **"Add New Project"**
   - Import your GitHub repository
   - Vercel automatically detects Next.js

2. **Configure Settings**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `prisma generate && next build` (auto-set)
   - **Output Directory**: `.next` (auto-set)
   - **Install Command**: `npm install` (auto-set)

3. **Set Environment Variables**
   - Add all required environment variables
   - Set for **Production**, **Preview**, and **Development**

4. **Deploy**
   - Click **"Deploy"**
   - Vercel automatically deploys on every `git push`

**Benefits:**
- ✅ Automatic deployments on push
- ✅ Preview deployments for pull requests
- ✅ Production deployments from main branch
- ✅ No CLI needed
- ✅ Built-in CI/CD

---

### Option 2: GitHub Actions CI/CD

**Best for**: Advanced workflows, custom build steps

Create `.github/workflows/vercel-deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Run tests
        run: npm test
        continue-on-error: true

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: ${{ github.ref == 'refs/heads/main' && '--prod' || '' }}
          scope: ${{ secrets.VERCEL_ORG_ID }}
```

**Required GitHub Secrets:**
- `VERCEL_TOKEN` - Get from Vercel dashboard
- `VERCEL_ORG_ID` - Get from Vercel dashboard
- `VERCEL_PROJECT_ID` - Get from Vercel dashboard
- `DATABASE_URL` - Your MongoDB connection string

---

### Option 3: Manual Git Push + Vercel CLI

**Best for**: When you want control but still use Git

```bash
# 1. Make changes and commit
git add .
git commit -m "Update feature"

# 2. Push to GitHub
git push origin main

# 3. Deploy to Vercel (if not auto-deploying)
vercel --prod
```

---

## 📋 Git-Based Deployment Workflow

### Standard Workflow

```
Developer
  ↓
1. Make code changes
  ↓
2. Commit changes
   git add .
   git commit -m "Description"
  ↓
3. Push to GitHub
   git push origin main
  ↓
4. Vercel detects push (if connected)
  ↓
5. Vercel builds automatically
  - Runs: npm install
  - Runs: prisma generate
  - Runs: next build
  ↓
6. Deploys to Preview/Production
  - Preview: For feature branches
  - Production: For main branch
  ↓
7. Vercel notifies you
  - Email notification
  - GitHub commit status
  - Vercel dashboard
```

---

## 🔀 Branch-Based Deployment Strategy

### Recommended Setup

| Branch | Deployment Type | Environment | Use Case |
|--------|----------------|-------------|----------|
| `main` | Production | Production env vars | Stable releases |
| `develop` | Preview | Preview env vars | Development |
| `feature/*` | Preview | Preview env vars | Feature branches |
| `hotfix/*` | Preview | Preview env vars | Quick fixes |

### Configuration in Vercel

1. **Production Branch**: `main`
2. **Preview Branches**: All other branches
3. **Auto-deploy**: Enabled

---

## 🔧 Setting Up Git Integration

### Step 1: Connect GitHub Repository

1. **Via Vercel Dashboard**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click **"Add New Project"**
   - Click **"Import Git Repository"**
   - Select your GitHub repository
   - Authorize Vercel to access GitHub

2. **Via Vercel CLI**
   ```bash
   vercel link
   # Follow prompts to connect repository
   ```

### Step 2: Configure Deployment Settings

In Vercel Dashboard → Project Settings → Git:

- **Production Branch**: `main`
- **Auto-deploy**: Enabled
- **Preview Deployments**: Enabled
- **Pull Request Comments**: Enabled (shows preview URL in PR)

### Step 3: Configure Build Settings

In Vercel Dashboard → Project Settings → General:

- **Framework Preset**: Next.js
- **Root Directory**: `./`
- **Build Command**: `prisma generate && next build`
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install`

### Step 4: Set Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

Add variables for each environment:
- **Production**: `main` branch
- **Preview**: All other branches
- **Development**: Local development

**Required Variables:**
```
DATABASE_URL=mongodb+srv://...
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://your-app.vercel.app
NODE_ENV=production
```

---

## 📦 Git Ignore Configuration

### .gitignore

Already configured in `.gitignore`:

```gitignore
# Vercel
.vercel

# Environment variables
.env
.env.local
.env.production.local

# Build outputs
.next
out
dist

# Dependencies
node_modules

# Prisma
prisma/migrations/
```

**Important**: Never commit:
- `.env` files
- `.vercel` folder (contains deployment info)
- `node_modules`
- Build outputs

---

## 🔄 Automatic Deployment Scenarios

### Scenario 1: Push to Main Branch

```bash
git checkout main
git add .
git commit -m "Release v1.0"
git push origin main
```

**Result:**
- ✅ Vercel detects push
- ✅ Builds automatically
- ✅ Deploys to **Production**
- ✅ Uses **Production** environment variables
- ✅ Updates production URL

### Scenario 2: Push to Feature Branch

```bash
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
```

**Result:**
- ✅ Vercel detects push
- ✅ Builds automatically
- ✅ Deploys to **Preview**
- ✅ Creates unique preview URL
- ✅ Uses **Preview** environment variables
- ✅ URL like: `feature-new-feature-abc123.vercel.app`

### Scenario 3: Create Pull Request

```bash
# Push feature branch
git push origin feature/new-feature

# Create PR on GitHub
# (via GitHub web interface)
```

**Result:**
- ✅ Vercel creates preview deployment
- ✅ Preview URL added as comment in PR
- ✅ Updates preview on each push to PR branch
- ✅ Preview uses **Preview** environment variables

### Scenario 4: Merge Pull Request

```bash
# Merge PR on GitHub (via web interface)
# This merges to main branch
```

**Result:**
- ✅ Vercel detects merge to `main`
- ✅ Builds automatically
- ✅ Deploys to **Production**
- ✅ Uses **Production** environment variables

---

## 🎯 Vercel Project Configuration File

### vercel.json

Already configured in `vercel.json`:

```json
{
  "buildCommand": "prisma generate && next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

This configuration is automatically used by Vercel when deploying from Git.

---

## 🔐 GitHub Secrets for CI/CD

If using GitHub Actions, add these secrets:

### How to Get Vercel Credentials

1. **VERCEL_TOKEN**
   - Go to Vercel Dashboard
   - Settings → Tokens
   - Create new token
   - Copy token

2. **VERCEL_ORG_ID**
   - Go to Vercel Dashboard
   - Settings → General
   - Copy "Team ID" or "Personal Account ID"

3. **VERCEL_PROJECT_ID**
   - Go to your project in Vercel
   - Settings → General
   - Copy "Project ID"

### Adding Secrets to GitHub

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret:
   - Name: `VERCEL_TOKEN`
   - Value: (paste token)
   - Repeat for other secrets

---

## 📊 Deployment Status & Notifications

### GitHub Integration Features

1. **Commit Status Checks**
   - Vercel adds status to each commit
   - Shows: ✅ Build succeeded / ❌ Build failed
   - Visible in GitHub PRs

2. **Pull Request Comments**
   - Vercel comments on PRs with preview URL
   - Updates automatically on new commits
   - Shows deployment status

3. **Deployment Badges**
   - Add badge to README:
   ```markdown
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-org/your-repo)
   ```

### Notification Settings

Configure in Vercel Dashboard → Settings → Notifications:

- ✅ Email notifications
- ✅ GitHub commit status
- ✅ Slack notifications (optional)
- ✅ Discord notifications (optional)

---

## 🐛 Troubleshooting Git-Based Deployments

### Issue: Deployments Not Triggering

**Solution:**
1. Check Vercel project is connected to GitHub
2. Verify branch is being watched
3. Check GitHub repository permissions
4. Reconnect repository if needed

### Issue: Build Fails on Vercel

**Common Causes:**
- Missing environment variables
- Prisma client not generated
- Build command incorrect
- Dependencies missing

**Solution:**
1. Check Vercel build logs
2. Verify environment variables are set
3. Test build locally: `npm run build`
4. Check `vercel.json` configuration

### Issue: Preview URL Not Working

**Solution:**
1. Check preview environment variables are set
2. Verify database allows connections from Vercel IPs
3. Check CORS settings
4. Review Vercel function logs

### Issue: Production Deploys from Wrong Branch

**Solution:**
1. Go to Vercel Dashboard → Settings → Git
2. Set "Production Branch" to `main`
3. Verify branch protection rules in GitHub

---

## 🔄 Git Workflow Best Practices

### 1. Branch Strategy

```
main (production)
  ├── develop (staging)
  │   ├── feature/user-auth
  │   ├── feature/payment
  │   └── hotfix/critical-bug
```

### 2. Commit Messages

Use conventional commits:
```bash
git commit -m "feat: add user authentication"
git commit -m "fix: resolve payment bug"
git commit -m "docs: update README"
```

### 3. Pull Request Process

1. Create feature branch
2. Make changes
3. Push to GitHub
4. Create PR (auto-creates preview)
5. Review preview deployment
6. Merge to main (auto-deploys to production)

### 4. Pre-commit Hooks (Optional)

Add to `.husky/pre-commit`:
```bash
#!/bin/sh
npm run lint
npm run type-check
npm test
```

---

## 📈 Monitoring Git-Based Deployments

### Vercel Dashboard

- **Deployments**: View all deployments by branch
- **Git Commits**: See which commit triggered deployment
- **Build Logs**: Full build output
- **Function Logs**: Serverless function logs
- **Analytics**: Performance metrics

### GitHub Integration

- **Commit Status**: Build status on commits
- **PR Comments**: Preview URLs in PRs
- **Deployment API**: Track deployments via GitHub API

---

## ✅ Git Deployment Checklist

### Initial Setup
- [ ] Repository connected to Vercel
- [ ] Production branch configured (`main`)
- [ ] Preview deployments enabled
- [ ] Environment variables set (Production, Preview)
- [ ] Build command configured
- [ ] `.gitignore` includes `.vercel` and `.env*`

### For Each Deployment
- [ ] Code committed to Git
- [ ] Pushed to GitHub
- [ ] Vercel build succeeds
- [ ] Preview/production deployment works
- [ ] Database migrations run (if needed)
- [ ] Application tested on deployed URL

---

## 🚀 Quick Start: Git-Based Deployment

### First Time Setup

1. **Connect Repository**
   ```bash
   # Go to vercel.com and import your GitHub repo
   # OR use CLI
   vercel link
   ```

2. **Set Environment Variables**
   ```bash
   # Via Vercel Dashboard or CLI
   vercel env add DATABASE_URL production
   vercel env add NEXTAUTH_SECRET production
   vercel env add NEXTAUTH_URL production
   ```

3. **Deploy**
   ```bash
   git push origin main
   # Vercel automatically deploys!
   ```

### Daily Workflow

```bash
# 1. Make changes
git add .
git commit -m "Description"
git push origin main

# 2. That's it! Vercel handles the rest
# - Automatic build
# - Automatic deployment
# - Automatic notifications
```

---

## 📚 Additional Resources

- [Vercel Git Integration](https://vercel.com/docs/concepts/git)
- [Vercel GitHub Integration](https://vercel.com/docs/concepts/git/vercel-for-github)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [GitHub Actions with Vercel](https://vercel.com/guides/how-can-i-use-github-actions-with-vercel)

---

**Git-based deployment is the recommended approach for Vercel!** It provides automatic deployments, preview URLs, and seamless integration with your Git workflow. 🚀

