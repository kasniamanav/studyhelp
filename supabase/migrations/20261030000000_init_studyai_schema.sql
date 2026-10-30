-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text default '',
  theme text check (theme in ('light', 'dark', 'system')) default 'system',
  default_difficulty text check (default_difficulty in ('easy', 'medium', 'hard')) default 'medium',
  default_explain_level text check (default_explain_level in ('beginner', 'simple', 'detailed', 'exam')) default 'simple',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 2. Materials Table
create table if not exists public.materials (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  subject text default '',
  topic text default '',
  content text default '',
  source_file_path text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. Quiz Attempts Table
create table if not exists public.quiz_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  material_id uuid references public.materials(id) on delete set null,
  topic text not null,
  type text check (type in ('quiz', 'mock')) not null default 'quiz',
  difficulty text check (difficulty in ('easy', 'medium', 'hard')) not null default 'medium',
  score integer not null default 0,
  total integer not null default 0,
  time_taken_sec integer default 0,
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 4. Flashcard Decks Table
create table if not exists public.flashcard_decks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  material_id uuid references public.materials(id) on delete set null,
  topic text not null,
  cards jsonb not null default '[]'::jsonb,
  difficult_indexes integer[] default '{}',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 5. Presentations Table
create table if not exists public.presentations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  material_id uuid references public.materials(id) on delete set null,
  topic text not null,
  slides jsonb not null default '[]'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 6. Chat Threads Table
create table if not exists public.chat_threads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  material_id uuid references public.materials(id) on delete set null,
  title text not null default 'New Conversation',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 7. Chat Messages Table
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references public.chat_threads(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Indexes for fast querying per user and chronological order
create index if not exists idx_materials_user_created on public.materials (user_id, created_at desc);
create index if not exists idx_quiz_attempts_user_created on public.quiz_attempts (user_id, created_at desc);
create index if not exists idx_flashcards_user_created on public.flashcard_decks (user_id, created_at desc);
create index if not exists idx_presentations_user_created on public.presentations (user_id, created_at desc);
create index if not exists idx_chat_threads_user_created on public.chat_threads (user_id, created_at desc);
create index if not exists idx_chat_messages_thread_created on public.chat_messages (thread_id, created_at asc);

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.presentations enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles Policies
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Materials Policies
create policy "Users can view own materials" on public.materials
  for select using (auth.uid() = user_id);

create policy "Users can create own materials" on public.materials
  for insert with check (auth.uid() = user_id);

create policy "Users can update own materials" on public.materials
  for update using (auth.uid() = user_id);

create policy "Users can delete own materials" on public.materials
  for delete using (auth.uid() = user_id);

-- Quiz Attempts Policies
create policy "Users can view own quiz attempts" on public.quiz_attempts
  for select using (auth.uid() = user_id);

create policy "Users can insert own quiz attempts" on public.quiz_attempts
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own quiz attempts" on public.quiz_attempts
  for delete using (auth.uid() = user_id);

-- Flashcards Policies
create policy "Users can view own flashcard decks" on public.flashcard_decks
  for select using (auth.uid() = user_id);

create policy "Users can insert own flashcard decks" on public.flashcard_decks
  for insert with check (auth.uid() = user_id);

create policy "Users can update own flashcard decks" on public.flashcard_decks
  for update using (auth.uid() = user_id);

create policy "Users can delete own flashcard decks" on public.flashcard_decks
  for delete using (auth.uid() = user_id);

-- Presentations Policies
create policy "Users can view own presentations" on public.presentations
  for select using (auth.uid() = user_id);

create policy "Users can insert own presentations" on public.presentations
  for insert with check (auth.uid() = user_id);

create policy "Users can update own presentations" on public.presentations
  for update using (auth.uid() = user_id);

create policy "Users can delete own presentations" on public.presentations
  for delete using (auth.uid() = user_id);

-- Chat Threads Policies
create policy "Users can view own chat threads" on public.chat_threads
  for select using (auth.uid() = user_id);

create policy "Users can insert own chat threads" on public.chat_threads
  for insert with check (auth.uid() = user_id);

create policy "Users can update own chat threads" on public.chat_threads
  for update using (auth.uid() = user_id);

create policy "Users can delete own chat threads" on public.chat_threads
  for delete using (auth.uid() = user_id);

-- Chat Messages Policies
create policy "Users can view own chat messages" on public.chat_messages
  for select using (auth.uid() = user_id);

create policy "Users can insert own chat messages" on public.chat_messages
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own chat messages" on public.chat_messages
  for delete using (auth.uid() = user_id);

-- Auto-create profile trigger on auth signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, theme, default_difficulty, default_explain_level)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'system',
    'medium',
    'simple'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Storage bucket setup for user study materials
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

create policy "Users can view own materials in storage"
  on storage.objects for select
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own materials to storage"
  on storage.objects for insert
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own materials from storage"
  on storage.objects for delete
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

-- Auto-confirm any existing unconfirmed users (useful for dev/demo)
update auth.users
set email_confirmed_at = timezone('utc'::text, now())
where email_confirmed_at is null;

-- Trigger to auto-confirm new signups immediately (avoids email confirmation blocker)
create or replace function public.auto_confirm_user()
returns trigger as $$
begin
  new.email_confirmed_at = coalesce(new.email_confirmed_at, timezone('utc'::text, now()));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_auto_confirm on auth.users;
create trigger on_auth_user_auto_confirm
  before insert on auth.users
  for each row execute procedure public.auto_confirm_user();

