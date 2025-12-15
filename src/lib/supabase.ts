import { createClient } from "@supabase/supabase-js";

// Pega as variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica se as variáveis de ambiente estão definidas
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Erro: SUPABASE_ENV NÃO DEFINIDAS NO VERCEL");
  throw new Error(
    "As variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY precisam ser configuradas corretamente no Vercel."
  );
}

// Cria o cliente do Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Exemplo de log para verificar se o cliente foi criado corretamente
console.log("Supabase client configurado com sucesso!");
