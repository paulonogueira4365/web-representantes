import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ONESIGNAL_APP_ID = "5f714a7b-1f68-495e-a56d-8cbc137d8f4b";
const ONESIGNAL_REST_API_KEY = "os_v2_app_l5yuu6y7nbev5jlnrs6bg7mpjmhjtanjip2uae5yzlf2nkuvom4dk7r6jvsww6y7ppscu4tyypcklq6mh3vkikduljbmwulecjcdhnq"; 

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    const { representante_id, nome_otica, nome_representante, cidade } = payload;

    if (!representante_id) throw new Error("representante_id ausente");

    const titulo = `Olá, ${nome_representante || 'Parceiro'}! 🚀`;
    const mensagem = `A ótica ${nome_otica || 'Nova Ótica'} em ${cidade || ''} já está disponível.`;

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [String(representante_id)],
        channel_for_external_user_ids: "push",
        headings: { pt: titulo },
        contents: { pt: mensagem },
        priority: 10,
        url: "https://web-representantes.vercel.app" 
      }),
    });

    const result = await response.json();
    const statusFinal = (response.ok && !result.errors) ? 'SUCESSO' : 'ERRO';

    // Grava Log Automático
    await supabaseClient.from('notificacao_logs').insert({
      representante_id: representante_id,
      tipo: 'AUTOMATICO',
      mensagem: mensagem,
      status: statusFinal,
      detalhes_api: result
    });

    return new Response(JSON.stringify(result), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500 
    });
  }
})