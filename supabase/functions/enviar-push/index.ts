import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_APP_ID = "5f714a7b-1f68-495e-a56d-8cbc137d8f4b";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!; // Adicione no Supabase Env

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async () => {
  try {
    const { data: fila } = await supabase
      .from("push_queue")
      .select("*")
      .eq("enviado", false)
      .limit(20);

    if (!fila || fila.length === 0) return Response.json({ ok: true, enviados: 0 });

    let enviados = 0;

    for (const item of fila) {
      const { data: rep } = await supabase
        .from("representantes")
        .select("nome")
        .eq("id", item.representante_id)
        .single();

      if (!rep) continue;

      const nome = rep.nome.split(" ")[0];
      const otica = item.payload;
      const local = otica.cidade ? `${otica.cidade}/${otica.uf}` : "";

      // DISPARO VIA ONESIGNAL
      const res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          // Aqui está o segredo: enviamos para o ID que você logou no Front
          include_external_user_ids: [item.representante_id],
          contents: { 
            "pt": `A ótica ${otica.nome} ${local ? '('+local+')' : ''} foi liberada para você.`,
            "en": `A ótica ${otica.nome} foi liberada.` 
          },
          headings: { "pt": `Boa notícia, ${nome}! 👋` },
          // Garante que o push "acorde" o celular
          android_visibility: 1,
          web_push_topic: "otica_liberada",
          data: { tipo: "OTICA_LIBERADA", otica_id: item.otica_id }
        })
      });

      const result = await res.json();
      console.log(`Resultado OneSignal: ${JSON.stringify(result)}`);

      // Se enviou com sucesso (ou ao menos tentou), marcamos na fila
      await supabase
        .from("push_queue")
        .update({ enviado: true, enviado_em: new Date().toISOString() })
        .eq("id", item.id);

      enviados++;
    }

    return Response.json({ ok: true, enviados });
  } catch (err) {
    console.error(err);
    return new Response("Erro", { status: 500 });
  }
});