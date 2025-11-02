import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }

  const redirectTo = requestUrl.searchParams.get('redirect_to')
  const redirectUrl = redirectTo ? new URL(redirectTo, requestUrl.origin) : new URL('/', requestUrl.origin)

  return NextResponse.redirect(redirectUrl)
}
