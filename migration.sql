-- Drop old messages table if it exists
drop table if exists public.messages cascade;

-- Create conversations table
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  ride_id uuid references public.rides(id) on delete cascade not null,
  driver_id uuid references public.profiles(id) on delete cascade not null,
  passenger_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(ride_id, passenger_id)
);

-- Enable RLS on conversations
alter table public.conversations enable row level security;

-- Policies for conversations
create policy "Allow users to view conversations they are part of" on public.conversations
  for select using (
    auth.uid() = driver_id or auth.uid() = passenger_id
  );

create policy "Allow conversations insertion by involved driver/passenger" on public.conversations
  for insert with check (
    auth.uid() = driver_id or auth.uid() = passenger_id
  );

-- Create messages table
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  message text not null,
  message_type text default 'text' check (message_type in ('text', 'coordination')) not null,
  read_status text default 'sent' check (read_status in ('sent', 'delivered', 'read')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on messages
alter table public.messages enable row level security;

-- Policies for messages
create policy "Allow users to view messages in their conversations" on public.messages
  for select using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id and (
        auth.uid() = conversations.driver_id or auth.uid() = conversations.passenger_id
      )
    )
  );

create policy "Allow users to insert messages in their conversations" on public.messages
  for insert with check (
    sender_id = auth.uid() and exists (
      select 1 from public.conversations
      where conversations.id = conversation_id and (
        auth.uid() = conversations.driver_id or auth.uid() = conversations.passenger_id
      )
    )
  );

create policy "Allow users to update message read_status in their conversations" on public.messages
  for update using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id and (
        auth.uid() = conversations.driver_id or auth.uid() = conversations.passenger_id
      )
    )
  ) with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id and (
        auth.uid() = conversations.driver_id or auth.uid() = conversations.passenger_id
      )
    )
  );

-- Indexes for performance
create index if not exists conversations_ride_id_idx on public.conversations(ride_id);
create index if not exists conversations_participants_idx on public.conversations(driver_id, passenger_id);
create index if not exists messages_conversation_id_idx on public.messages(conversation_id);

-- Enable Supabase Realtime replication for messages and conversations
do $$
begin
  -- Try to drop tables from publication, ignore error if they aren't in it
  begin
    alter publication supabase_realtime drop table public.conversations;
  exception when others then
    -- Ignore
  end;
  
  begin
    alter publication supabase_realtime drop table public.messages;
  exception when others then
    -- Ignore
  end;
  
  -- Add tables
  alter publication supabase_realtime add table public.conversations, public.messages;
end $$;

-- Alter rides table to add new columns for instant booking, exact coordinates, addresses and routing metrics
alter table public.rides add column if not exists instant_booking boolean default false not null;
alter table public.rides add column if not exists pickup_address text;
alter table public.rides add column if not exists pickup_latitude double precision;
alter table public.rides add column if not exists pickup_longitude double precision;
alter table public.rides add column if not exists dropoff_address text;
alter table public.rides add column if not exists dropoff_latitude double precision;
alter table public.rides add column if not exists dropoff_longitude double precision;
alter table public.rides add column if not exists estimated_distance double precision;
alter table public.rides add column if not exists estimated_duration double precision;
