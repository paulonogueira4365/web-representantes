/// <reference lib="deno.window" />

import admin from "npm:firebase-admin@12";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ======================================================
   ENV
====================================================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID");
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL");
const FIREBASE_PRIVATE_KEY_BASE64 = Deno.env.get("FIREBASE_PRIVATE_KEY_BASE64");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase ENV missing");
}

if (
  !FIREBASE_PROJECT_ID ||
  !FIREBASE_CLIENT_EMAIL ||
  !FIREBASE_PRIVATE_KEY_BASE64
) {
  throw new Error("Firebase ENV missing");
}

/* ======================================================
   SUPABASE CLIENT
====================================================== */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* ======================================================
   FIREBASE PRIVATE KEY (BASE64 → PEM LIMPO)
====================================================== */
const FIREBASE_PRIVATE_KEY = new TextDecoder()
  .decode(
    Uint8Array.from(
      atob(FIREBASE_PRIVATE_KEY_BASE64),
      (c) => c.charCodeAt(0)
    )
  )
  .replace(/\r\n/g, "\n")
  .replace(/\r/g, "\n")
  .trim();

/* ======================================================
   FIREBASE ADMIN INIT
====================================================== */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY,
    }),
  });

  console.log("Firebase Admin initialized");
}

/* ======================================================
   EDGE FUNCTION
====================================================== */
export default async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "content-type",
        },
      });
    }

    const body = await req.json().catch(() => null);

    if (!body?.representante_id) {
      return new Response("representante_id ausente", { status: 400 });
    }

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select(
        `
        fcm_token,
        representantes ( nome )
      `
      )
      .eq("representante_id", body.representante_id)
      .not("fcm_token", "is", null);

    if (error) {
      console.error("Supabase error:", error);
      return new Response("Erro ao buscar tokens", { status: 500 });
    }

    if (!data || data.length === 0) {
      return new Response("Nenhum token encontrado", { status: 200 });
    }

    const tokens = [
  ...new Set(data.map((d) => d.fcm_token).filter(Boolean))
];

    const nome = data[0]?.representantes?.nome ?? "Representante";

    if (!tokens.length) {
      return new Response("Nenhum token válido", { status: 200 });
    }

    const result = await admin.messaging().sendEachForMulticast({
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

    console.log("Push result:", {
      success: result.successCount,
      failure: result.failureCount,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        enviados: result.successCount,
        falhas: result.failureCount,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ERRO PUSH:", err);
    return new Response("Erro interno", { status: 500 });
  }
};
