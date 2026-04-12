import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = process.env.SUPABASE_URL || "";
const rawSupabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
const supabaseUrl = rawSupabaseUrl.trim();
const supabaseKey = rawSupabaseKey.trim();

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ SUPABASE_URL or SUPABASE_SERVICE_KEY is not defined. Authentication features will run in permissive mode or fail.");
}

// Fallback URL so createClient does not throw invalid URL error on startup
export const supabase = createClient(supabaseUrl || "https://dummy.supabase.co", supabaseKey || "dummy-key");
