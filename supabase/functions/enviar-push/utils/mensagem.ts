export function gerarMensagemPush({
  representanteNome,
  oticaNome,
  cidade,
  uf
}: {
  representanteNome: string;
  oticaNome: string;
  cidade?: string;
  uf?: string;
}) {
  const primeiroNome = representanteNome.split(" ")[0];

  const local =
    cidade && uf
      ? `${cidade}/${uf}`
      : cidade
      ? cidade
      : uf
      ? uf
      : "";

  return {
    title: `Boa notícia, ${primeiroNome}! 👋`,
    body: local
      ? `A ótica ${oticaNome} (${local}) foi liberada e já está disponível no seu painel.`
      : `A ótica ${oticaNome} foi liberada e já está disponível no seu painel.`,
  };
}
