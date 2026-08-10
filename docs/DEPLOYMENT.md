# Deployment Guide

## Pre-Deployment Checklist

- [ ] All tests pass (`npm run lint`)
- [ ] Build succeeds without errors (`npm run build`)
- [ ] No console errors in browser
- [ ] Tested on multiple devices (mobile, tablet, desktop)
- [ ] Both languages (EN/RO) work correctly
- [ ] All tasks features work (add, edit, delete, complete)
- [ ] Calendar displays correctly
- [ ] localStorage functionality verified
- [ ] Environment variables set (if any)

## Local Build

### Build for Production

```bash
npm run build
```

**Output**:
```
dist/
├── index.html               (Entry point)
├── assets/
│   ├── index-CrRLMk5o.css  (Styles)
│   └── index-DM1mLFAs.js   (JavaScript)
```

### Preview Production Build Locally

```bash
npm run preview
```

Opens preview at `http://localhost:4173`

## Deployment Options

### Option 1: Vercel (Recommended)

**Pros**:
- Zero-config deployment
- Automatic previews for PRs
- Free tier available
- Git integration
- HTTPS by default

**Steps**:

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

3. Or connect GitHub:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import Git repository
   - Click "Deploy"

**Configuration** (`vercel.json`):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

### Option 2: Netlify

**Pros**:
- Drag-and-drop deployment
- Free SSL/TLS
- Git integration
- CMS integration available

**Steps**:

1. Connect GitHub:
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Select repository

2. Configure build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

3. Deploy automatically on push

**Configuration** (`netlify.toml`):
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Option 3: GitHub Pages

**Pros**:
- Free hosting
- Built-in with GitHub
- No external service needed

**Steps**:

1. Update `package.json`:
```json
{
  "homepage": "https://username.github.io/blank-canvas-studio"
}
```

2. Install gh-pages:
```bash
npm install --save-dev gh-pages
```

3. Add deploy scripts to `package.json`:
```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

4. Deploy:
```bash
npm run deploy
```

5. Enable GitHub Pages in repository settings:
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: gh-pages

### Option 4: Docker Deployment

**Benefits**:
- Consistent across environments
- Easy scaling
- Works with any hosting

**Dockerfile**:
```dockerfile
# Build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

**Build and Run**:
```bash
docker build -t tasks-calendar .
docker run -p 3000:3000 tasks-calendar
```

**Docker Compose** (`docker-compose.yml`):
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
```

### Option 5: Traditional Server (Node.js)

**Setup**:

1. Install Node.js 16+ on server

2. Copy project files:
```bash
scp -r dist/ user@server:/var/www/tasks-calendar/
```

3. Install serve:
```bash
npm install -g serve
```

4. Run:
```bash
serve -s dist -l 3000
```

**Using PM2 for Process Management**:
```bash
npm install -g pm2

# Start app
pm2 start "serve -s dist -l 3000" --name tasks-calendar

# Auto-restart on server reboot
pm2 startup
pm2 save
```

**Nginx Configuration**:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/tasks-calendar/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache assets
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTTPS redirect
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.crt;
    ssl_certificate_key /path/to/key.key;

    root /var/www/tasks-calendar/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Environment Setup

### Environment Variables

Create `.env.local` (not committed to Git):
```
VITE_API_URL=https://api.example.com
VITE_APP_NAME=Tasks & Calendar
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

### Production Build Optimization

```bash
# Check bundle size
npm run build -- --analyze

# Tree-shaking unused code
npm run build

# Analyze in bundle analyzer
npm install -g rollup-plugin-visualizer
```

## Security Considerations

### Before Deployment

- [ ] Remove console.logs from production code
- [ ] Set proper CORS headers
- [ ] Configure security headers:
  - Content-Security-Policy
  - X-Frame-Options
  - X-Content-Type-Options

### HTTPS

Always use HTTPS in production:
- Vercel/Netlify: Automatic
- Self-hosted: Use Let's Encrypt (certbot)

```bash
# Certbot for Nginx
sudo certbot certonly --nginx -d yourdomain.com
```

### Content Security Policy (CSP)

Add to HTML or server header:
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self';">
```

## Performance Optimization

### Web Vitals

- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

### Monitoring

1. **Lighthouse**: Built into Chrome DevTools
   - Score target: 90+
   - Audit: Performance, Accessibility, Best Practices, SEO

2. **Web Vitals**: Monitor real user metrics
   - Use library: `web-vitals`
   - Send to analytics service

3. **Error Tracking**: Set up Sentry
```bash
npm install @sentry/react
```

### Caching Strategy

**Static Assets** (1 year):
```
/assets/ → Cache-Control: public, max-age=31536000, immutable
```

**HTML** (No cache):
```
/index.html → Cache-Control: no-cache, no-store, must-revalidate
```

## Monitoring & Analytics

### Set Up Error Tracking (Sentry)

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: "production",
  tracesSampleRate: 1.0,
});
```

### Set Up Analytics

```typescript
import { trackEvent } from '@analytics/service'

trackEvent('task_created', { timestamp: Date.now() })
```

## Rollback Plan

### If Issues After Deployment

1. **Immediate Rollback**:
   - Vercel: Click "Redeploy" on previous deployment
   - Netlify: Click previous deploy in Deploy history
   - GitHub Pages: Revert last commit

2. **Debug Process**:
   - Check error logs
   - Review recent changes
   - Test locally with same Node version
   - Verify environment variables

3. **Communication**:
   - Inform users of issue
   - Provide status updates
   - Share timeline for fix

## Post-Deployment Checklist

- [ ] Site loads without errors
- [ ] All features work (tasks, calendar, language switching)
- [ ] Responsive design looks correct
- [ ] localStorage persists data
- [ ] No browser console errors
- [ ] Page loads within 3 seconds
- [ ] HTTPS is working
- [ ] Analytics are tracking
- [ ] Monitoring/error tracking active
- [ ] Database backups (if applicable)

## Continuous Deployment (CI/CD)

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## Troubleshooting Deployment

### Build Fails

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Assets Not Loading

Check:
- Asset paths in `vite.config.ts`
- Public folder files
- Base URL setting

### Blank Page in Production

1. Check HTML console for errors
2. Verify index.html loads
3. Check JavaScript bundle loads
4. Verify assets/CSS loads

### localStorage Not Persisting

- Check if localStorage is enabled in browser
- Verify not in private/incognito mode
- Check storage quota not exceeded

## Performance Benchmarks

### Current Metrics

- Build time: ~2 seconds
- Bundle size: 207 KB (65 KB gzipped)
- Lighthouse score: 95+
- Page load: < 1 second
- First Contentful Paint (FCP): < 0.5s

### Target Metrics

- Build time: < 3 seconds
- Bundle size: < 100 KB gzipped
- Lighthouse: 95+
- Page load: < 1.5 seconds
- All Core Web Vitals: Good

## Maintenance

### Regular Tasks

- Monitor error tracking (daily)
- Check performance metrics (weekly)
- Update dependencies (monthly)
- Review analytics (monthly)
- Security audits (quarterly)

### Update Dependencies

```bash
npm update                    # Minor/patch updates
npm outdated                  # Check for updates
npm audit                     # Check vulnerabilities
npm audit fix                 # Fix vulnerabilities
```

## Support & Documentation

- **Issues**: GitHub repository
- **Documentation**: See `/docs` folder
- **Deployment Support**: Check hosting provider's docs
