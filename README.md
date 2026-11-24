# KOOLIE — Static Worker-Booking Marketplace

**KOOLIE** is a complete static frontend prototype connecting households in Kerala with local and migrant daily-wage workers, general labourers, and skilled tradespeople.

## Architecture

- **100% Static Website**: Built with React, TypeScript, Tailwind CSS, and Vite (`dist/` output).
- **Zero Backend Required**: No API routes, servers, databases, or environment variables are needed.
- **Browser Persistence**: All accounts, bookings, Priority Circulation records, chats, ratings, no-show reports, transactions, notifications, admin settings, and Light/Dark theme state persist in `localStorage`.

## Deploying to Vercel

1. Push this project to a GitHub repository.
2. Import the repository in [Vercel](https://vercel.com).
3. Vercel automatically reads `vercel.json` (`npm run build` -> `dist`) and serves the static site with no environment variables needed.

## Deploying to GitHub Pages

1. Push this project to a GitHub repository with the default branch `main`.
2. In your GitHub repository, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds `dist/` with relative asset paths (`base: './'`) and deploys automatically.

## Local Development

```bash
npm install
npm run dev
npm run build
```
