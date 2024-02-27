import { NextResponse } from 'next/server';

const AUTHORIZED_URLS = ['https://profissao-ia.memberz.com.br'];

function isUrlAuthorized(referrer) {
  return AUTHORIZED_URLS.some(authorizedUrl => referrer.includes(authorizedUrl));
}

export function middleware(request) {
  // Apenas executa a lógica em produção e no lado do cliente
  if (process.env.NODE_ENV === 'production') {
    const referrer = request.headers.get('referer');
    const isInIframe = request.headers.get('sec-fetch-dest') === 'iframe';

    if (isInIframe && referrer) {
      if (!isUrlAuthorized(referrer)) {
        return new Response('Acesso não autorizado!', {
          status: 403,
          statusText: 'Forbidden',
        });
      }
    }
  }

  // Permite a solicitação prosseguir caso não esteja em um iframe ou seja de um URL autorizado
  return NextResponse.next();
}
