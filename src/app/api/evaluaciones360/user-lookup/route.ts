export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

export interface UserLookupResult {
  email:     string;
  fullName:  string | null;
  avatarUrl: string | null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("email, full_name, avatar_url")
    .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(8);

  const results: UserLookupResult[] = (data ?? []).map((u: {
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  }) => ({
    email:     u.email,
    fullName:  u.full_name || null,
    avatarUrl: u.avatar_url || null,
  }));

  return NextResponse.json(results);
}
