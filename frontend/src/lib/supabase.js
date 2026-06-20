import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.dbbnuszdpshyrauczmtv;
const supabaseKey = import.meta.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiYm51c3pkcHNoeXJhdWN6bXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NzgzNTQsImV4cCI6MjA5NzU1NDM1NH0.eKFBqZR1YDzV49De8qc2esvRndWndlcHhPa2ILajWxA;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);