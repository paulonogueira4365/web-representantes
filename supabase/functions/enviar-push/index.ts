// supabase/functions/enviar-push/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===============================
// 🔐 ENV
// ===============================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
const FIREBASE_PRIVATE_KEY = Deno.env
  .get("FIREBASE_PRIVATE_KEY")!
  .replace(/\\n/g, "\n");

// ===============================
// 🔌 SUPABASE
// ===============================
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ===============================
// 🔥 FIREBASE AUTH (JWT)
// ===============================
async function getFirebaseAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const base64url = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const jwtUnsigned =
    base64url(header) + "." + base64url(payload);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    encoder.encode(FIREBASE_PRIVATE_KEY),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(jwtUnsigned)
  );

  const jwt =
    jwtUnsigned +
    "." +
    btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const json = await res.json();
  return json.access_token as string;
}

// ===============================
// 🧠 MENSAGEM
// ===============================
function montarMensagem(repNome: string, otica: any) {
  const nome = repNome.split(" ")[0];
  const local =
    otica.cidade && otica.uf
      ? `${otica.cidade}/${otica.uf}`
      : "";

  return {
    title: `Boa notícia, ${nome}! 👋`,
    body: local
      ? `A ótica ${otica.nome} (${local}) foi liberada para você.`
      : `A ótica ${otica.nome} foi liberada para você.`,
  };
}

// ===============================
// 🚀 HANDLER
// ===============================
serve(async () => {
  try {
    const token = await getFirebaseAccessToken();

    const { data: fila } = await supabase
      .from("push_queue")
      .select("*")
      .eq("enviado", false)
      .limit(20);

    if (!fila || fila.length === 0) {
      return Response.json({ ok: true, enviados: 0 });
    }

    let enviados = 0;

    for (const item of fila) {
      const { data: rep } = await supabase
        .from("representantes")
        .select("nome")
        .eq("id", item.representante_id)
        .single();

      const { data: tokens } = await supabase
        .from("push_subscriptions")
        .select("fcm_token")
        .eq("representante_id", item.representante_id);

      if (!rep || !tokens?.length) continue;

      const { title, body } = montarMensagem(rep.nome, item.payload);

      for (const t of tokens) {
        await fetch(
          `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: t.fcm_token,
                notification: { title, body },
                data: {
                  tipo: "OTICA_LIBERADA",
                  otica_id: item.otica_id,
                },
              },
            }),
          }
        );
      }

      await supabase
        .from("push_queue")
        .update({
          enviado: true,
          enviado_em: new Date().toISOString(),
        })
        .eq("id", item.id);

      enviados++;
    }

    return Response.json({ ok: true, enviados });
  } catch (err) {
    console.error(err);
    return new Response("Erro interno", { status: 500 });
  }
});
