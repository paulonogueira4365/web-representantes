/// <reference lib="deno.window" />

import admin from "npm:firebase-admin@12";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- SUPABASE ----------
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ---------- FIREBASE ADMIN ----------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: Deno.env.get("FIREBASE_PROJECT_ID"),
      clientEmail: Deno.env.get("FIREBASE_CLIENT_EMAIL"),
      privateKey: Deno.env
        .get("FIREBASE_PRIVATE_KEY")
        ?.replace(/\\n/g, "\n"),
    }),
  });
}

export default async (req: Request) => {
  try {
    const { representante_id } = await req.json();

    if (!representante_id) {
      return new Response("representante_id ausente", { status: 400 });
    }

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select(`
        fcm_token,
        representantes ( nome )
      `)
      .eq("representante_id", representante_id)
      .not("fcm_token", "is", null);

    if (error || !data?.length) {
      return new Response("Nenhum token encontrado", { status: 200 });
    }

    const tokens = data.map((d) => d.fcm_token);
    const nome = data[0].representantes?.nome ?? "Representante";

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "Nova ótica liberada",
        body: `${nome}, uma nova ótica foi disponibilizada para você.`,
      },
      webpush: {
        fcmOptions: {
          link: "https://web-representantes.vercel.app",
        },
      },
    });

    return new Response(
      JSON.stringify({ ok: true, enviados: tokens.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ERRO PUSH:", err);
    return new Response("Erro interno", { status: 500 });
  }
};
