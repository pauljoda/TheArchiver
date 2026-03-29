---
name: Next.js migration from .NET Aspire
description: TheArchiver was migrated from .NET Aspire (C#) to Next.js (TypeScript) on 2026-03-29
type: project
---

TheArchiver was fully migrated from .NET Aspire to Next.js on the `next-js-migration` branch on 2026-03-29.

**Why:** The .NET version had 5+ containers, was complex to develop plugins for (required compiling DLLs), and the frontend was server-rendered Razor. The new stack is simpler: 2 containers (app + Redis), TypeScript plugins (just drop a folder in plugins/), and React + shadcn/ui frontend.

**How to apply:** The main branch still has the old .NET code. The `next-js-migration` branch has the new Next.js code. Plugins now need to be `.js` files (not `.ts` — TypeScript plugins need compilation first since they're loaded at runtime via `require`).
