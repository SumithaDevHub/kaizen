# 改善 KAIZEN

### Forge Your Progress.

**A personal productivity workspace for planning, tracking, and improving — one task, one week, one step at a time.**

[**Launch KAIZEN →**](https://kaizen-henna.vercel.app/login)

---

## About KAIZEN

**KAIZEN (改善)** is inspired by the Japanese philosophy of continuous improvement — the belief that meaningful progress comes from small, consistent actions.

Built as a modern, cloud-connected productivity application, KAIZEN brings together weekly planning, Kanban task management, and personal organization in a single workspace.

Its visual identity combines a dark, minimalist interface with Japanese-inspired design elements, including the red spider lily (_Higanbana_).

**Plan with intention. Execute with focus. Improve continuously.**

## Features

### Kanban Task Management

Organize your work through five stages:

`Backlog → To Do → In Progress → Review → Completed`

- Create, edit, and delete tasks.
- Move tasks between workflow stages.
- Set priorities and due dates.
- Organize tasks by category.
- Track progress using subtasks.

### Weekly Planning

Turn long-term goals into manageable weekly actions.

- Organize tasks by planned week.
- Navigate between weeks.
- Monitor current priorities.
- Keep unfinished work visible.

### Personal Workspace

KAIZEN is designed for individual productivity with cloud-based accounts.

- Email-based registration and login.
- Private, account-specific task data.
- Supabase-backed storage.
- Access your workspace across devices.

### Productivity Tools

- Task search and filtering.
- Category management.
- Task progress tracking.
- JSON backup import and export.
- Responsive layouts and scrollable Kanban boards.

### Visual Experience

KAIZEN features a dark, cinematic visual language inspired by Japanese storytelling and the concept of perseverance.

The red spider lily serves as a recurring visual motif, complemented by restrained typography, deep crimson accents, and a distraction-conscious interface.

---

## Technology Stack

| Layer           | Technology                    |
| --------------- | ----------------------------- |
| Framework       | Next.js 15                    |
| Language        | TypeScript                    |
| Frontend        | React                         |
| Authentication  | Supabase Auth                 |
| Database        | Supabase PostgreSQL           |
| Data Security   | PostgreSQL Row Level Security |
| Icons           | Lucide React                  |
| Hosting         | Vercel                        |
| Version Control | Git & GitHub                  |

## Getting Started

### Prerequisites

- Node.js and npm
- A Supabase project
- Git

### Installation

Clone the repository:

```bash
git clone https://github.com/SumithaDevHub/kaizen.git
cd kaizen
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

The application requires a compatible Supabase database schema, authentication configuration, and Row Level Security policies.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm run start
```

## Application Architecture

```text
KAIZEN
│
├── Authentication
│   ├── Login / Signup
│   └── Password Recovery
│
├── Productivity Workspace
│   ├── Dashboard
│   ├── Kanban Board
│   ├── Weekly Planning
│   ├── Tasks & Subtasks
│   └── Categories
│
├── Data Management
│   ├── Supabase PostgreSQL
│   ├── User-Based Access Control
│   └── JSON Backup / Import
│
└── Deployment
    └── Vercel
```

## Data Privacy

KAIZEN uses Supabase Authentication and PostgreSQL Row Level Security to support user-specific workspaces.

Tasks, categories, and subtasks are associated with individual accounts. The database includes ownership constraints and cascading subtask deletion.

Production privacy and account-recovery flows should be validated before wider public use.

## Project Status

**Version 1 — Deployed**

The initial release focuses on essential task management, weekly planning, cloud persistence, and a consistent user experience.

Future enhancements may include productivity analytics, advanced planning tools, additional personalization, and improved mobile interactions.

## Design Philosophy

KAIZEN is built around three principles:

**Clarity** — Keep priorities visible and workflows understandable.

**Consistency** — Encourage meaningful progress through manageable daily and weekly actions.

**Improvement** — Make it easier to reflect, adapt, and move forward.

---

### 改善 — KAIZEN

_Small steps. Relentless progress._

**[Open KAIZEN](https://kaizen-henna.vercel.app/login)**

Built with Next.js, TypeScript, and Supabase.
