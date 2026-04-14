import { createClient } from "@supabase/supabase-js";

// Cliente con SERVICE_ROLE_KEY: bypasea RLS completamente.
// Usar SOLO en servidor (API routes, Server Components). Nunca en el cliente.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
