import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ONESIGNAL_APP_ID = "5f714a7b-1f68-495e-a56d-8cbc137d8f4b";
const ONESIGNAL_API_KEY = "gqpyhvhj7u6nmglrcodybku4e"; // Pegue no painel do OneSignal

serve(async (req) => {
  const { record } = await req.json(); // Dados da nova ótica

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${ONESIGNAL_API_KEY}`
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: [record.representante_id], // Envia para o dono da ótica
      contents: { en: `Nova ótica liberada: ${record.nome}`, pt: `Nova ótica liberada: ${record.nome}` },
      headings: { en: "UPLAB Alerta", pt: "UPLAB Alerta" },
      url: `https://web-representantes.vercel.app/representante/${record.representante_id}`
    })
  });

  return new Response(JSON.stringify(await res.json()), { headers: { "Content-Type": "application/json" } });
})