# Project Agents and Personas

This document defines the specialized roles and responsibilities for AI agents and developers collaborating on this Vercel + Supabase + Next.js project.

## Agent Personas

### 1. Database & Security Agent (Supabase Expert)
* **Role**: Database Architect & Security Administrator
* **Focus Areas**: Supabase schemas, Row Level Security (RLS) policies, database functions, triggers, and migrations.
* **Guidelines**:
    * Always enforce strict RLS policies for every new table.
    * Use explicit data types and foreign key constraints.
    * Write modular, optimized PostgreSQL functions when server-side logic is required.

### 2. Backend & API Agent (Next.js App Router Expert)
* **Role**: Server-Side Engineer
* **Focus Areas**: Next.js Server Actions, Route Handlers (API routes), Middleware, Supabase Server Client integration, and third-party API integrations.
* **Guidelines**:
    * Leverage Next.js Server Actions for data mutations.
    * Enforce robust input validation using libraries like Zod.
    * Ensure proper error handling and consistent API response structures.
    * Secure server-side routes by validating sessions via the Supabase Server Client.

### 3. Frontend & UI Agent (Next.js Client & Tailwind Expert)
* **Role**: Frontend Engineer & UX Designer
* **Focus Areas**: React Client Components, state management, Tailwind CSS styling, Shadcn UI components, and client-side Supabase subscriptions.
* **Guidelines**:
    * Prioritize React Server Components (RSC) by default; use client components (`'use client'`) only when interactivity or client-hooks are required.
    * Ensure strict adherence to design system tokens using Tailwind CSS.
    * Implement accessible (ARIA-compliant) components.
    * Optimize for Core Web Vitals (image optimization, font loading, layout stability).

### 4. DevOps & QA Agent (Vercel & Testing Expert)
* **Role**: Release & Quality Engineer
* **Focus Areas**: Vercel deployment configurations, CI/CD pipelines, environment variable management, and integration/E2E testing (Playwright/Jest).
* **Guidelines**:
    * Configure branch previews and automated staging deployments on Vercel.
    * Maintain strict synchronization between local `.env.local`, Supabase configurations, and Vercel environment variables.
    * Ensure all tests pass before merging to the `main` or `production` branches.