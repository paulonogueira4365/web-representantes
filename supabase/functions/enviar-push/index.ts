/// <reference lib="deno.window" />

import admin from "npm:firebase-admin@12";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ----------------- SUPABASE -----------------
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ----------------- FIREBASE -----------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: Deno.env.get("FIREBASE_PROJECT_ID"),
      clientEmail: Deno.env.get("FIREBASE_CLIENT_EMAIL"),
      privateKey: atob(Deno.env.get("FIREBASE_PRIVATE_KEY_BASE64")!),
    }),
  });

  console.log("Firebase Admin initialized");
}

export default async (req: Request) => {
  try {
    const { otica_id } = await req.json();

    if (!otica_id) {
      return new Response("otica_id ausente", { status: 400 });
    }

    // 🔎 buscar ótica
    const { data: otica } = await supabase
      .from("oticas")
      .select("nome")
      .eq("id", otica_id)
      .single();

    if (!otica) {
      return new Response("Ótica não encontrada", { status: 404 });
    }

    // 🔎 buscar representantes vinculados
    const { data: reps } = await supabase
      .from("otica_representante")
      .select(`
        representante_id,
        representantes ( nome )
      `)
      .eq("otica_id", otica_id);

    if (!reps?.length) {
      return new Response("Nenhum representante vinculado", { status: 200 });
    }

    const repIds = reps.map((r) => r.representante_id);

    // 🔎 buscar tokens
    const { data: tokensRaw } = await supabase
      .from("push_subscriptions")
      .select("fcm_token, representante_id")
      .in("representante_id", repIds);

    const tokens = tokensRaw?.map((t) => t.fcm_token).filter(Boolean) ?? [];

    if (!tokens.length) {
      return new Response("Nenhum token encontrado", { status: 200 });
    }

    // 🚀 enviar push
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "Nova ótica liberada 🎉",
        body: `A ótica "${otica.nome}" foi liberada para atendimento.`,
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
