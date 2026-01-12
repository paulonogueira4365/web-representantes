import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método não permitido" }),
        { status: 405 }
      );
    }

    const body = await req.json();

    const { tipo, representante_id, nome } = body;

    if (tipo !== "otica_liberada") {
      return new Response(
        JSON.stringify({ ok: true, ignored: true }),
        { status: 200 }
      );
    }

    if (!representante_id || !nome) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios ausentes" }),
        { status: 400 }
      );
    }

    const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ONESIGNAL_REST_API_KEY ausente" }),
        { status: 500 }
      );
    }

    const payload = {
      app_id: "5f714a7b-1f68-495e-a56d-8cbc137d8f4b",
      include_external_user_ids: [representante_id],
      contents: {
        en: `Ótica ${nome} liberada!`,
        pt: `Ótica ${nome} liberada!`,
      },
      headings: {
        en: "Sistema",
        pt: "Sistema",
      },
    };

    const response = await fetch(
      "https://onesignal.com/api/v1/notifications",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${apiKey}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.text();

    return new Response(
      JSON.stringify({
        onesignal_status: response.status,
        onesignal_response: result,
      }),
      { status: 200 }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Erro interno",
        message: String(err),
      }),
      { status: 500 }
    );
  }
});
