create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  assigned_member_id uuid not null references public.team_members(id),
  merchant text not null check (char_length(btrim(merchant)) between 1 and 160),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('EUR', 'VND')),
  category text not null check (char_length(btrim(category)) between 1 and 50),
  renewal_day integer not null check (renewal_day between 1 and 31),
  next_due date not null,
  reminder_days integer not null default 3 check (reminder_days between 1 and 14),
  active boolean not null default true,
  confirmed_due date,
  created_at timestamptz not null default now()
);
create index recurring_expenses_team_idx on public.recurring_expenses(team_id);
alter table public.recurring_expenses enable row level security;
revoke all on public.recurring_expenses from anon, authenticated;
grant select, insert, update, delete on public.recurring_expenses to service_role;
