export const config = {
  auth: false
};

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      representante_id,
      tipo = "AUTOMATICO",
      mensagem,
      nome_otica,
      nome_representante,
      cidade,
    } = body;

    if (!representante_id) {
      throw new Error("representante_id é obrigatório");
    }

    /* =====================
       VERIFICA PUSH ATIVO
    ===================== */
    const { data: rep } = await supabase
      .from("representantes")
      .select("push_active")
      .eq("id", representante_id)
      .single();

    if (!rep?.push_active) {
      return new Response(
        JSON.stringify({ ok: false, reason: "Push desativado" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    /* =====================
       MENSAGEM
    ===================== */
    let tituloFinal = "Nova notificação";
    let mensagemFinal = mensagem;

    if (tipo === "AUTOMATICO") {
      tituloFinal = `Olá, ${nome_representante || "Parceiro"}! 🚀`;
      mensagemFinal = `A ótica ${
        nome_otica || "Nova Ótica"
      } em ${cidade || ""} já está disponível.`;
    }

    if (!mensagemFinal) {
      throw new Error("Mensagem não informada");
    }

    /* =====================
       ONE SIGNAL
    ===================== */
    const response = await fetch(
      "https://onesignal.com/api/v1/notifications",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_external_user_ids: [String(representante_id)],
          channel_for_external_user_ids: "push",
          headings: {
            pt: tituloFinal,
            en: tituloFinal,
          },
          contents: {
            pt: mensagemFinal,
            en: mensagemFinal,
          },
          priority: 10,
          url: "https://web-representantes.vercel.app",
        }),
      }
    );

    const result = await response.json();

    const statusFinal =
      response.ok && result?.id && !result?.errors
        ? "SUCESSO"
        : "ERRO";

    /* =====================
       LOG
    ===================== */
    await supabase.from("notificacao_logs").insert({
      representante_id,
      tipo,
      mensagem: mensagemFinal,
      status: statusFinal,
      detalhes_api: result,
    });

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
