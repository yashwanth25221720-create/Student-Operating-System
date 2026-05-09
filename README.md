# SOS App

SOS is a student productivity OS built with Vite, React, Supabase, and optional OpenAI-powered helpers.

It includes goals, tasks, notes, flashcards, a study timer, calendar views, onboarding, themes, and AI tools for planning, study notes, code help, resumes, and workspace commands.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Fill in:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_AI_ENDPOINT=https://your-project.supabase.co/functions/v1/invoke-llm
VITE_AI_API_KEY=your-supabase-anon-key
```

5. For AI, deploy `supabase/functions/invoke-llm` and set `OPENAI_API_KEY` as a Supabase function secret.

6. Configure Google sign-in and OTP emails using `supabase/auth-setup.md`.

For quick local testing only, you can set `VITE_OPENAI_API_KEY`, but do not ship a browser-exposed OpenAI key in production.

## Commands

```bash
npm install
npm run dev
npm run build
```
