-- Migration: Add driver_id to ride_bookings for efficient inbox queries
-- Run this in your Supabase SQL Editor

-- Add driver_id column
ALTER TABLE public.ride_bookings 
ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Backfill existing bookings with driver_id from rides
UPDATE public.ride_bookings rb
SET driver_id = r.driver_id
FROM public.rides r
WHERE rb.ride_id = r.id AND rb.driver_id IS NULL;

-- Create index for fast inbox lookups
CREATE INDEX IF NOT EXISTS ride_bookings_driver_id_idx ON public.ride_bookings(driver_id);
CREATE INDEX IF NOT EXISTS ride_bookings_status_idx ON public.ride_bookings(status);

-- Add a trigger to auto-populate driver_id on new bookings
CREATE OR REPLACE FUNCTION public.auto_set_booking_driver_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.driver_id IS NULL THEN
    SELECT driver_id INTO NEW.driver_id FROM public.rides WHERE id = NEW.ride_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_set_booking_driver_id ON public.ride_bookings;
CREATE TRIGGER trg_auto_set_booking_driver_id
BEFORE INSERT ON public.ride_bookings
FOR EACH ROW EXECUTE FUNCTION public.auto_set_booking_driver_id();

-- Enable realtime for ride_bookings so the inbox can listen for updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'ride_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_bookings;
  END IF;
END $$;
