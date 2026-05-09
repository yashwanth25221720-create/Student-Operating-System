create extension if not exists "pgcrypto";

create or replace function public.set_updated_date()
returns trigger as $$
begin
  new.updated_date = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text,
  status text default 'active' check (status in ('active', 'paused', 'completed', 'abandoned')),
  progress numeric default 0,
  target_date date,
  xp_reward numeric default 100,
  steps jsonb default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  category text,
  due_date date,
  goal_id uuid references public.goals(id) on delete set null,
  xp_reward numeric default 10,
  estimated_minutes numeric default 15,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text,
  subject text,
  tags text[] default '{}',
  type text default 'note' check (type in ('note', 'summary', 'flashcard_set', 'mindmap')),
  goal_id uuid references public.goals(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer text not null,
  subject text,
  difficulty text default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  mastery numeric default 0,
  last_reviewed timestamptz,
  review_count numeric default 0,
  note_id uuid references public.notes(id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  duration_minutes numeric not null,
  type text default 'pomodoro' check (type in ('pomodoro', 'deep_focus', 'review', 'practice')),
  xp_earned numeric default 0,
  goal_id uuid references public.goals(id) on delete set null,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

drop trigger if exists goals_set_updated_date on public.goals;
create trigger goals_set_updated_date before update on public.goals
for each row execute function public.set_updated_date();

drop trigger if exists tasks_set_updated_date on public.tasks;
create trigger tasks_set_updated_date before update on public.tasks
for each row execute function public.set_updated_date();

drop trigger if exists notes_set_updated_date on public.notes;
create trigger notes_set_updated_date before update on public.notes
for each row execute function public.set_updated_date();

drop trigger if exists flashcards_set_updated_date on public.flashcards;
create trigger flashcards_set_updated_date before update on public.flashcards
for each row execute function public.set_updated_date();

drop trigger if exists study_sessions_set_updated_date on public.study_sessions;
create trigger study_sessions_set_updated_date before update on public.study_sessions
for each row execute function public.set_updated_date();

alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.flashcards enable row level security;
alter table public.study_sessions enable row level security;

create policy "Users manage own goals" on public.goals
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own tasks" on public.tasks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own notes" on public.notes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own flashcards" on public.flashcards
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own study sessions" on public.study_sessions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
