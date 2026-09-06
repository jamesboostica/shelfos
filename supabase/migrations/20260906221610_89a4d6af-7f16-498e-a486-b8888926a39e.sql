create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  avatar_url text,
  role text default 'cashier' check (role in ('manager', 'cashier')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

alter table public.profiles enable row level security;

create or replace function public.is_manager(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id and role = 'manager'
  )
$$;

create policy "Users can view own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Managers can view all profiles"
on public.profiles for select
to authenticated
using (public.is_manager(auth.uid()));

create policy "Managers can update roles"
on public.profiles for update
to authenticated
using (public.is_manager(auth.uid()));

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Store User'),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    case when (select count(*) from public.profiles) = 0 then 'manager' else 'cashier' end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();