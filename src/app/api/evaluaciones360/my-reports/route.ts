export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

// Autoservicio: cualquier usuario con sesión ve SUS PROPIOS reportes ya
// enviados (sin chequeo de rol — es su propio dato, filtrado por su email).
// Alimenta el aviso "tu reporte está disponible" en "Mis Evaluaciones 360°".
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const rows = await prisma.evaluation360Report.findMany({
      where: { evaluateeEmail: user.email.trim().toLowerCase(), status: "sent" },
      include: { evaluation: { select: { id: true, title: true } } },
      orderBy: { sentAt: "desc" },
    });

    return NextResponse.json({
      reports: rows.map((r) => ({
        evaluationId: r.evaluation.id,
        title:        r.evaluation.title,
        sentAt:       r.sentAt,
      })),
    });
  } catch (error) {
    console.error("[GET my-reports]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
