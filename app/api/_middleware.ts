import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const AUTHORIZED_URLS = ['https://profissao-ia.memberz.com.br'];

function isUrlAuthorized(referrer: string | null): boolean {
  return AUTHORIZED_URLS.some(authorizedUrl => referrer?.includes(authorizedUrl));
}

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const referrer = request.headers.get('referer');
    const isInIframe = request.headers.get('sec-fetch-dest') === 'iframe';

    if (isInIframe && referrer) {
      if (!isUrlAuthorized(referrer)) {
        return Response.json(
          { success: false, message: 'Acesso não autorizado!' },
          { status: 403 }
        )
      }
    }
  }

  return NextResponse.next();
}
