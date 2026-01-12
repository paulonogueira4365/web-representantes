import type { PageLoad } from './$types';

// 💡 Isso desabilita a renderização no servidor para esta rota,
// evitando o erro "SyntaxError: Unexpected token 'export'" da biblioteca OneSignal.
export const ssr = false;

export const load: PageLoad = ({ params }) => {
  return {
    id: params.id
  };
};