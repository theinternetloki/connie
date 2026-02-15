import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // During build, if env vars aren't set, create a client with placeholder values
  // This allows the build to succeed, and the client will be recreated at runtime with real values
  if (!supabaseUrl || !supabaseAnonKey) {
    try {
      return createClient("https://placeholder.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder");
    } catch {
      // If even placeholder fails, return a minimal client
      return createClient("https://example.supabase.co", "placeholder");
    }
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // During build, if env vars aren't set, create a client with placeholder values
  if (!supabaseUrl || !serviceRoleKey) {
    try {
      return createClient("https://placeholder.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder", {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    } catch {
      return createClient("https://example.supabase.co", "placeholder", {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Lazy initialization - only create when first accessed
function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient();
  }
  return supabaseClient;
}

function getSupabaseAdminClient(): SupabaseClient {
  if (!supabaseAdminClient) {
    supabaseAdminClient = createSupabaseAdminClient();
  }
  return supabaseAdminClient;
}

// Export as getters that initialize on first access
// This allows the build to succeed even without env vars
export const supabase = getSupabaseClient();
export const supabaseAdmin = getSupabaseAdminClient();
