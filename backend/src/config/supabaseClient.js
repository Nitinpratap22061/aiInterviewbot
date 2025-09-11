
import { createClient } from '@supabase/supabase-js';
import dotenv from "dotenv";
dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;        // for client/browser
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;  // for backend (bypasses RLS)

export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
