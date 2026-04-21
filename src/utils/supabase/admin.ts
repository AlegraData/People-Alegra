import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}

// Proxy transparente: el cliente se crea solo cuando se usa por primera vez,
// no al importar el módulo. Esto evita errores en build time.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop: string) {
    const client = getClient();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
