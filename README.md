# StudyAI — Production-Quality AI Study Companion

> A modern, full-stack, AI-powered study companion rebuilt from the `StudyAI.html` prototype. Features real authentication, PostgreSQL persistence with Row-Level Security, document parsing (.pdf, .docx, .pptx, .txt), swappable AI providers via Supabase Edge Functions, and exam preparation tools.

---

## Architecture Overview

```
/
├── .env.example                       # Reference environment variables
├── package.json                       # Dependencies & scripts
├── vite.config.ts                     # Vite + Tailwind + alias configuration
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx          # Responsive wrapper (desktop sidebar + mobile bottom nav & drawer)
│   │   │   ├── Sidebar.tsx            # Desktop sidebar navigation
│   │   │   └── MobileNav.tsx          # Mobile bottom tab bar + slide-over drawer
│   │   └── ui/
│   │       ├── Skeleton.tsx           # Loading state primitive
│   │       └── Toast.tsx              # Dynamic toast notification system
│   ├── features/
│   │   ├── auth/                      # Email/password, Google OAuth, 1-click demo login
│   │   ├── dashboard/                 # Stats, score-over-time charts (Recharts), weak topics
│   │   ├── materials/                 # CRUD, file extraction (.txt, .pdf, .docx, .pptx), Storage
│   │   ├── explainer/                 # 4 explanation levels, structured JSON outputs, follow-up tutor chat
│   │   ├── quiz/                      # MCQ generation, interactive test taking, instant review with explanations
│   │   ├── mock/                      # Timed exams, countdown timer, question grid navigator, localStorage recovery
│   │   ├── flashcards/                # 3D flip animation, shuffle, mark difficult, review difficult-only mode
│   │   ├── presentation/              # Structured slide deck generator, fullscreen viewer, .pptx & PDF export
│   │   ├── chat/                      # Grounded tutor chat (RAG-lite), persistent threads, convert to quiz/flashcards
│   │   └── settings/                  # Profile name, themes (light/dark/system), defaults, JSON export, account wipe
│   ├── lib/
│   │   ├── ai.ts                      # Client AI service (invokes Edge Function with local fallback)
│   │   ├── fileParsers.ts             # PDF (pdfjs-dist), Word (mammoth), PowerPoint (jszip), text parser
│   │   ├── schemas.ts                 # Zod validation schemas for all AI outputs
│   │   ├── supabase.ts                # Supabase client and TypeScript data interfaces
│   │   └── utils.ts                   # Formatting, DOMPurify sanitizer, class merging
│   └── store/
│       ├── useUIStore.ts              # Theme, active material, free topics, toasts
│       └── useMockRunStore.ts         # Persistent mock test state surviving page refreshes
├── supabase/
│   ├── migrations/
│   │   └── 20261030000000_init_studyai_schema.sql  # Database tables, triggers, indexes, and RLS policies
│   ├── functions/
│   │   ├── _shared/cors.ts            # CORS headers
│   │   └── ai/
│   │       ├── index.ts               # Edge function router, rate limiter (30/hr), input caps, retry logic
│   │       ├── prompts.ts             # Centralized server-side prompt engineering
│   │       └── providers.ts           # Swappable providers (Gemini, OpenAI, Claude)
│   └── seed.sql                       # Sample demo study materials and quiz records
└── e2e/
    └── smoke.spec.ts                  # Playwright smoke test (Login -> Add Material -> Generate Quiz)
```

---

## Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Your `.env` should look like:
```env
VITE_SUPABASE_URL=https://hvaehuttdngpoqfcowmm.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_DIi4DT6FngGn0Fa-cWyKug_KvY9hFGc

# AI Configuration (Edge Function Secrets or local development fallback)
AI_PROVIDER=gemini
AI_MODEL=gemini-1.5-flash
AI_API_KEY=your_gemini_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Database & Supabase Setup

### Option A: Via Supabase SQL Editor (Fastest)
1. Navigate to your [Supabase Dashboard](https://app.supabase.com) -> **SQL Editor**.
2. Copy the contents of `supabase/migrations/20261030000000_init_studyai_schema.sql` and run it.
3. (Optional) Run `supabase/seed.sql` to populate sample materials for demonstration.

### Option B: Via Supabase CLI
```bash
# Link to your Supabase project
supabase link --project-ref hvaehuttdngpoqfcowmm

# Push the schema migrations
supabase db push
```

### Database Tables with RLS:
- `profiles`: User preferences (theme, difficulty, explain depth), auto-created on signup via trigger `on_auth_user_created`.
- `materials`: User notes and documents with full text extracted.
- `quiz_attempts`: Past quiz and mock exam scores, answers, and questions.
- `flashcard_decks`: Saved card decks and difficult card indices.
- `presentations`: Saved presentation slides JSON.
- `chat_threads` & `chat_messages`: Persistent tutor conversation threads.
- `storage.objects`: Private `materials` bucket isolated per user (`auth.uid() = (storage.foldername(name))[1]`).

---

## Deploying the AI Edge Function

All AI generation goes through a single Supabase Edge Function (`/functions/v1/ai`). The Edge Function:
- Keeps API keys secure on the server.
- Enforces user rate limits (30 calls/hour).
- Restricts input size (max 40,000 characters).
- Runs 1 automatic retry on JSON parse failures.
- Validates JSON format.

### Deploy the Edge Function:
```bash
# 1. Deploy the 'ai' function
supabase functions deploy ai

# 2. Set server secrets (API Key and Provider)
supabase secrets set AI_PROVIDER=gemini
supabase secrets set AI_MODEL=gemini-1.5-flash
supabase secrets set AI_API_KEY=your_gemini_api_key_here
```

> **Client Fallback**: If you run `npm run dev` locally before deploying the Edge Function to Supabase, the app automatically falls back to client Gemini using `VITE_GEMINI_API_KEY`, ensuring uninterrupted development.

---

## How to Get an AI API Key

### Google Gemini (Default)
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API key** and create a new API key.
3. Paste it into `AI_API_KEY` and `VITE_GEMINI_API_KEY`.

### Swapping Providers (OpenAI or Claude)
Set these in your Supabase project secrets:
- **OpenAI**: `AI_PROVIDER=openai`, `AI_MODEL=gpt-4o-mini`, `AI_API_KEY=sk-...`
- **Claude**: `AI_PROVIDER=claude`, `AI_MODEL=claude-3-5-sonnet-20241022`, `AI_API_KEY=sk-ant-...`

---

## Testing

### Unit Tests (Vitest)
Unit tests cover scoring logic, JSON validation, and timer intervals:
```bash
npm test
```
Result: 12 tests passing across `scoring.test.ts`, `validation.test.ts`, and `timer.test.ts`.

### Smoke Tests (Playwright)
```bash
npx playwright test
```

### Production Build
```bash
npm run build
```
Creates an optimized, minified bundle in `/dist`.

---

## Deploying to Vercel

1. Push your code to GitHub.
2. In the [Vercel Dashboard](https://vercel.com), click **Add New** -> **Project** and import your repository.
3. Configure the environment variables:
   - `VITE_SUPABASE_URL`: `https://hvaehuttdngpoqfcowmm.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `sb_publishable_DIi4DT6FngGn0Fa-cWyKug_KvY9hFGc`
   - `VITE_GEMINI_API_KEY`: Your Gemini API key
4. Click **Deploy**. Vercel will build and serve your app.

---

## Features Ported & Enhanced from Prototype

| Feature | Prototype (`StudyAI.html`) | Full Web App (`StudyAI`) |
| :--- | :--- | :--- |
| **Auth** | Mock sandbox UID | Supabase Auth (Email/Password, Google OAuth, 1-Click Demo) |
| **Database** | Sandboxed Claude doc store | PostgreSQL with Row-Level Security & Cascade Deletion |
| **File Upload** | Only `.txt` supported | `.txt`, `.pdf`, `.docx`, `.pptx` automatic text extraction + Storage bucket |
| **Explainer** | Static cards | Structured JSON with markdown, badges, copy, and follow-up AI tutor chat |
| **Quizzes** | In-memory with limited save | Easy/Medium/Hard, 5/10/20 Qs, Zod schema validation, past attempts history |
| **Mock Tests** | Basic timer | Auto-submit countdown, question navigator grid, mark-for-review, refresh survival (`localStorage`) |
| **Flashcards** | Basic flip | 3D card flip, shuffle, mark difficult, review difficult-only mode, keyboard shortcuts (<kbd>Space</kbd>, <kbd>←</kbd>, <kbd>→</kbd>) |
| **Presentation** | "Soon" | Full AI slide deck generator, in-app fullscreen presentation mode, export to `.pptx` and `PDF` |
| **AI Chat** | "Soon" | Material-grounded chat (RAG-lite), persistent threads, thread rename/delete, "turn answer into quiz/flashcards" |
| **Dashboard** | Simple counter | Materials count, quizzes taken, average score, performance over time chart (Recharts), weak topics focus |
| **Settings** | "Soon" | Profile editor, Light/Dark/System themes, default study preferences, complete JSON export, account data wipe |

