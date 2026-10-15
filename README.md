# KAIZEN 改善 — Forge Your Progress

A subtle anime-inspired, responsive weekly Kanban application built with Next.js 15 and TypeScript.

## Features
- Five Kanban lanes, drag tasks between lanes (desktop HTML5 drag and drop)
- Weekly navigation, planning, search, categories, priorities, due dates and subtasks
- Dashboard, All Tasks, Weekly Planner, category manager
- Browser localStorage persistence and JSON import/export
- Decorative original mountain artwork and Japanese-inspired ornamentation

## Run locally

Install Node.js 20 or later, then:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy free with GitHub + Vercel

1. Create a GitHub repository and push this project (do not commit `node_modules` or `.next`).
2. Import the repository in Vercel, select Next.js, and deploy.
3. Future pushes to your main branch trigger new deployments.

## Storage — important

**This version uses browser localStorage, not Supabase.** Data is stored per browser/origin and is not synchronized across devices. Use Settings → Export backup to safeguard tasks. Hosting on Vercel does not make task storage cloud-backed. For multi-device sync, add Supabase Auth, PostgreSQL tables and row-level security policies before going live with personal data.

## Design

Inspired by atmospheric fantasy anime aesthetics without using copyrighted character art or logos. Mountain background is an original SVG. Google Fonts are loaded from the internet.
