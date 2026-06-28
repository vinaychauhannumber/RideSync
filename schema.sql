-- RideSync Database Schema
-- Run this in your Supabase SQL Editor to set up tables, triggers, indexes, and RLS.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Drop existing triggers and functions if they exist
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Drop trigger safely only if the table exists to prevent PostgreSQL 42P01 error
do $$
begin
  if exists (
    select 1 
    from pg_tables 
    where schemaname = 'public' 
      and tablename = 'ride_bookings'
  ) then
    execute 'drop trigger if exists trg_update_ride_seats on public.ride_bookings';
  end if;
end $$;

drop function if exists public.update_ride_seats();

-- Create Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  avatar_url text,
  gender text check (gender in ('male', 'female', 'other')),
  phone_number text,
  age integer check (age >= 18),
  bio text,
  vehicle_details jsonb, -- {type: string, model: string, color: string, number: string, year: number}
  license_number text,
  is_verified boolean default false,
  role text default 'passenger' check (role in ('passenger', 'driver', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Rides table
create table if not exists public.rides (
  id uuid default gen_random_uuid() primary key,
  driver_id uuid references public.profiles(id) on delete cascade not null,
  source text not null,
  destination text not null,
  pickup_location text not null,
  drop_location text not null,
  departure_date date not null,
  departure_time time not null,
  total_seats integer not null check (total_seats > 0),
  available_seats integer not null check (available_seats >= 0),
  price_per_seat numeric(10,2) not null check (price_per_seat >= 0),
  vehicle_type text not null,
  vehicle_number text not null,
  description text,
  status text default 'scheduled' not null check (status in ('scheduled', 'active', 'completed', 'cancelled')),
  instant_booking boolean default false not null,
  pickup_address text,
  pickup_latitude double precision,
  pickup_longitude double precision,
  dropoff_address text,
  dropoff_latitude double precision,
  dropoff_longitude double precision,
  estimated_distance double precision,
  estimated_duration double precision,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Ride Bookings table
create table if not exists public.ride_bookings (
  id uuid default gen_random_uuid() primary key,
  ride_id uuid references public.rides(id) on delete cascade not null,
  passenger_id uuid references public.profiles(id) on delete cascade not null,
  seats_booked integer default 1 not null check (seats_booked > 0),
  note text,
  status text default 'pending' not null check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'active', 'completed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(ride_id, passenger_id)
);

-- Create Conversations table
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  ride_id uuid references public.rides(id) on delete cascade not null,
  driver_id uuid references public.profiles(id) on delete cascade not null,
  passenger_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(ride_id, passenger_id)
);

alter table public.conversations enable row level security;

create policy "Allow users to view conversations they are part of" on public.conversations
  for select using (auth.uid() = driver_id or auth.uid() = passenger_id);

create policy "Allow conversations insertion by involved driver/passenger" on public.conversations
  for insert with check (auth.uid() = driver_id or auth.uid() = passenger_id);

-- Create Messages table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  message text not null,
  message_type text default 'text' check (message_type in ('text', 'coordination')) not null,
  read_status text default 'sent' check (read_status in ('sent', 'delivered', 'read')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.messages enable row level security;

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

-- Create Notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null, -- booking_request, booking_accepted, booking_rejected, new_message, driver_arrived, ride_started, ride_completed
  title text not null,
  content text not null,
  link_id uuid, -- ride_id or booking_id
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Reviews table
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  ride_id uuid references public.rides(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  reviewee_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  experience_rating integer check (experience_rating >= 1 and experience_rating <= 5),
  safety_rating integer check (safety_rating >= 1 and safety_rating <= 5),
  punctuality_rating integer check (punctuality_rating >= 1 and punctuality_rating <= 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Live Locations table
create table if not exists public.live_locations (
  id uuid default gen_random_uuid() primary key,
  ride_id uuid references public.rides(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (ride_id, user_id)
);

-- Create Ride Tracking Sessions table
create table if not exists public.ride_tracking_sessions (
  ride_id uuid references public.rides(id) on delete cascade primary key,
  status text default 'inactive' not null check (status in ('inactive', 'pickup', 'active', 'completed')),
  driver_location_lat double precision,
  driver_location_lng double precision,
  passenger_location_lat double precision,
  passenger_location_lng double precision,
  driver_shared boolean default false not null,
  passenger_shared boolean default false not null,
  driver_arrived boolean default false not null,
  passenger_picked_up boolean default false not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Triggers to automatically update updated_at timestamps
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- Trigger to automatically create a Profile after a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role, is_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'RideSync User'),
    new.raw_user_meta_data->>'avatar_url',
    'passenger',
    false
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Trigger to automatically adjust available seats based on booking status
create or replace function public.update_ride_seats()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') and NEW.status = 'accepted' then
    update public.rides
    set available_seats = available_seats - NEW.seats_booked
    where id = NEW.ride_id;
  elsif (TG_OP = 'UPDATE') then
    if OLD.status != 'accepted' and NEW.status = 'accepted' then
      update public.rides
      set available_seats = available_seats - NEW.seats_booked
      where id = NEW.ride_id;
    elsif OLD.status = 'accepted' and NEW.status != 'accepted' then
      update public.rides
      set available_seats = available_seats + NEW.seats_booked
      where id = NEW.ride_id;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_update_ride_seats
after insert or update on public.ride_bookings
for each row execute function public.update_ride_seats();

-- Indexes for performance optimizations
create index if not exists rides_source_destination_idx on public.rides(source, destination);
create index if not exists rides_departure_date_idx on public.rides(departure_date);
create index if not exists ride_bookings_ride_id_idx on public.ride_bookings(ride_id);
create index if not exists ride_bookings_passenger_id_idx on public.ride_bookings(passenger_id);
create index if not exists messages_ride_id_idx on public.messages(ride_id);
create index if not exists messages_created_at_idx on public.messages(created_at);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_is_read_idx on public.notifications(is_read);
create index if not exists reviews_reviewee_id_idx on public.reviews(reviewee_id);
create index if not exists live_locations_ride_id_idx on public.live_locations(ride_id);

-- Enable RLS for all tables
alter table public.profiles enable row level security;
alter table public.rides enable row level security;
alter table public.ride_bookings enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.live_locations enable row level security;
alter table public.ride_tracking_sessions enable row level security;

-- RLS Policies

-- Profiles Policies
create policy "Allow public read access to profiles" on public.profiles
  for select using (true);

create policy "Allow users to update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Rides Policies
create policy "Allow public read access to rides" on public.rides
  for select using (true);

create policy "Allow authenticated users to create rides" on public.rides
  for insert with check (auth.role() = 'authenticated');

create policy "Allow drivers to update their own rides" on public.rides
  for update using (auth.uid() = driver_id);

create policy "Allow drivers to delete their own rides" on public.rides
  for delete using (auth.uid() = driver_id);

-- Ride Bookings Policies
create policy "Allow passengers to see their own bookings and drivers to see bookings for their rides" on public.ride_bookings
  for select using (
    auth.uid() = passenger_id or 
    exists (
      select 1 from public.rides 
      where rides.id = ride_bookings.ride_id and rides.driver_id = auth.uid()
    )
  );

create policy "Allow passengers to request bookings" on public.ride_bookings
  for insert with check (auth.role() = 'authenticated' and auth.uid() = passenger_id);

create policy "Allow passengers to update their own booking or drivers to accept/reject" on public.ride_bookings
  for update using (
    auth.uid() = passenger_id or 
    exists (
      select 1 from public.rides 
      where rides.id = ride_bookings.ride_id and rides.driver_id = auth.uid()
    )
  );

-- Messages Policies
create policy "Allow chat participants to read messages" on public.messages
  for select using (
    auth.uid() = sender_id or 
    auth.uid() = receiver_id or
    exists (
      select 1 from public.ride_bookings
      where ride_bookings.ride_id = messages.ride_id and ride_bookings.passenger_id = auth.uid() and ride_bookings.status = 'accepted'
    ) or
    exists (
      select 1 from public.rides
      where rides.id = messages.ride_id and rides.driver_id = auth.uid()
    )
  );

create policy "Allow chat participants to post messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
  );

-- Notifications Policies
create policy "Allow users to read their own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Allow users to update their own notifications" on public.notifications
  for update using (auth.uid() = user_id);

create policy "Allow notification creation" on public.notifications
  for insert with check (true);

-- Reviews Policies
create policy "Allow public read access to reviews" on public.reviews
  for select using (true);

create policy "Allow authenticated users to create reviews" on public.reviews
  for insert with check (auth.role() = 'authenticated' and auth.uid() = reviewer_id);

-- Live Locations Policies
create policy "Allow tracking participants to view locations" on public.live_locations
  for select using (
    exists (
      select 1 from public.rides
      where rides.id = live_locations.ride_id and rides.driver_id = auth.uid()
    ) or
    exists (
      select 1 from public.ride_bookings
      where ride_bookings.ride_id = live_locations.ride_id and ride_bookings.passenger_id = auth.uid() and ride_bookings.status = 'accepted'
    )
  );

create policy "Allow users to insert/update their own locations" on public.live_locations
  for insert with check (auth.uid() = user_id);

create policy "Allow users to update their own locations" on public.live_locations
  for update using (auth.uid() = user_id);

-- Ride Tracking Sessions Policies
create policy "Allow ride participants to view tracking sessions" on public.ride_tracking_sessions
  for select using (
    exists (
      select 1 from public.rides
      where rides.id = ride_tracking_sessions.ride_id and (rides.driver_id = auth.uid() or exists (
        select 1 from public.ride_bookings
        where ride_bookings.ride_id = rides.id and ride_bookings.passenger_id = auth.uid()
      ))
    )
  );

create policy "Allow drivers or passengers to update tracking sessions" on public.ride_tracking_sessions
  for insert with check (true);

create policy "Allow drivers or passengers to edit tracking sessions" on public.ride_tracking_sessions
  for update using (true);

-- ==========================================
-- SEED MOCK AUTHENTICATION USERS
-- ==========================================
-- Run this block in your Supabase SQL Editor to generate sample accounts.
-- Passwords for all three test accounts: password123

-- Enable pgcrypto in extensions schema
create extension if not exists pgcrypto;

-- 1. Seed Driver Account (email: driver@ridesync.com)
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  'd0d4e32a-d0b8-4d56-bc98-b8086a988d55',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'driver@ridesync.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"John Driver"}',
  now(),
  now()
) on conflict (id) do nothing;

-- Update profile for Driver (is_verified = true, role = driver, sets vehicle details)
update public.profiles
set 
  role = 'driver', 
  is_verified = true, 
  license_number = 'DL-99887766', 
  vehicle_details = '{"type":"sedan","model":"Honda Civic","color":"Silver","number":"5ABC123","year":2021}'::jsonb,
  bio = 'Commutes daily from San Francisco to San Jose. Friendly and loves sharing routes!'
where id = 'd0d4e32a-d0b8-4d56-bc98-b8086a988d55';


-- 2. Seed Passenger Account (email: passenger@ridesync.com)
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'passenger@ridesync.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Jane Passenger"}',
  now(),
  now()
) on conflict (id) do nothing;


-- 3. Seed Admin Account (email: admin@ridesync.com)
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  'f9e8d7c6-b5a4-3210-fedc-ba9876543210',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@ridesync.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Alex Admin"}',
  now(),
  now()
) on conflict (id) do nothing;

-- Update profile for Admin (role = admin)
-- Update profile for Admin (role = admin)
update public.profiles
set role = 'admin'
where id = 'f9e8d7c6-b5a4-3210-fedc-ba9876543210';


-- ==========================================
-- PAYMENTS & TRANSFERS SYSTEM
-- ==========================================

-- Create Payments Table
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references public.ride_bookings(id) on delete cascade not null,
  amount numeric(10,2) not null check (amount >= 0),
  status text default 'paid' not null check (status in ('paid', 'pending', 'refunded')),
  payment_method text default 'card' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Transfers Table
create table if not exists public.transfers (
  id uuid default gen_random_uuid() primary key,
  driver_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(10,2) not null check (amount >= 0),
  status text default 'completed' not null check (status in ('completed', 'pending', 'failed')),
  bank_name text not null,
  account_number text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.payments enable row level security;
alter table public.transfers enable row level security;

-- Policies for Payments
create policy "Allow passengers to see their payments and drivers to see payments for their rides" on public.payments
  for select using (
    exists (
      select 1 from public.ride_bookings
      where ride_bookings.id = payments.booking_id and (
        ride_bookings.passenger_id = auth.uid() or
        exists (
          select 1 from public.rides
          where rides.id = ride_bookings.ride_id and rides.driver_id = auth.uid()
        )
      )
    )
  );

create policy "Allow payments insertion" on public.payments
  for insert with check (true);

-- Policies for Transfers
create policy "Allow drivers to view their own transfers" on public.transfers
  for select using (auth.uid() = driver_id);

create policy "Allow transfers insertion" on public.transfers
  for insert with check (true);

-- Indexes for performance
create index if not exists payments_booking_id_idx on public.payments(booking_id);
create index if not exists transfers_driver_id_idx on public.transfers(driver_id);


-- ==========================================
-- SEED SAMPLE TRANSACTIONS
-- ==========================================

-- 1. Create a mock ride that took place yesterday (driver is John Driver)
insert into public.rides (
  id,
  driver_id,
  source,
  destination,
  pickup_location,
  drop_location,
  departure_date,
  departure_time,
  total_seats,
  available_seats,
  price_per_seat,
  vehicle_type,
  vehicle_number,
  status
) values (
  'e2e8e9ea-e2b8-4d56-bc98-b8086a988d55',
  'd0d4e32a-d0b8-4d56-bc98-b8086a988d55',
  'San Francisco',
  'Los Angeles',
  'Civic Center BART',
  'Union Station East',
  now()::date - 1,
  '08:00:00',
  4,
  2,
  25.00,
  'sedan',
  '5ABC123',
  'completed'
) on conflict (id) do nothing;

-- 2. Create a mock booking for Jane Passenger
insert into public.ride_bookings (
  id,
  ride_id,
  passenger_id,
  seats_booked,
  note,
  status
) values (
  'b1b2b3b4-b5b6-7a8b-9c0d-1e2f3a4b5c6d',
  'e2e8e9ea-e2b8-4d56-bc98-b8086a988d55',
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  2,
  'Traveling with a friend. Look forward to it!',
  'completed'
) on conflict (ride_id, passenger_id) do nothing;

-- 3. Seed passenger payment linked to the booking
insert into public.payments (
  id,
  booking_id,
  amount,
  status,
  payment_method
) values (
  'p1p2p3p4-p5p6-7a8b-9c0d-1e2f3a4b5c6d',
  'b1b2b3b4-b5b6-7a8b-9c0d-1e2f3a4b5c6d',
  50.00,
  'paid',
  'Visa **** 4321'
) on conflict (id) do nothing;

-- 4. Seed payout transfers for the driver
insert into public.transfers (
  id,
  driver_id,
  amount,
  status,
  bank_name,
  account_number
) values (
  't1t2t3t4-t5t6-7a8b-9c0d-1e2f3a4b5c6d',
  'd0d4e32a-d0b8-4d56-bc98-b8086a988d55',
  50.00,
  'completed',
  'Chase Bank',
  '******1234'
) on conflict (id) do nothing;

insert into public.transfers (
  id,
  driver_id,
  amount,
  status,
  bank_name,
  account_number
) values (
  't2t2t3t4-t5t6-7a8b-9c0d-1e2f3a4b5c6e',
  'd0d4e32a-d0b8-4d56-bc98-b8086a988d55',
  75.00,
  'completed',
  'Chase Bank',
  '******1234'
) on conflict (id) do nothing;


-- =========================================================================
-- PROFILE PREFERENCES, VEHICLES & VERIFICATION EXTENSIONS
-- =========================================================================

alter table public.profiles add column if not exists preferences jsonb default '{"chatty": "comfortable", "music": "depending_on_mood", "smoking": "no_smoking", "pets": "depending_on_animal"}'::jsonb;
alter table public.profiles add column if not exists is_id_verified boolean default false;
alter table public.profiles add column if not exists is_phone_verified boolean default false;
alter table public.profiles add column if not exists vehicles jsonb default '[]'::jsonb;

-- Seed default values for existing users
update public.profiles
set preferences = '{"chatty": "comfortable", "music": "depending_on_mood", "smoking": "no_smoking", "pets": "depending_on_animal"}'::jsonb
where preferences is null;

update public.profiles
set vehicles = '[]'::jsonb
where vehicles is null;


