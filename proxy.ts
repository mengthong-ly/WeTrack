import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

// Signed-out visitors go straight to sign-in. Pages stream their signed-in parts after a static
// shell, so without this the redirect would only arrive after the shell. A cookie check only:
// requireMember still verifies the session on every page and action.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()
  return NextResponse.redirect(new URL("/sign-in", request.url))
}

export const config = {
  // Everything but auth pages, the public CEO link, API routes and static files.
  matcher: ["/((?!api|_next/static|_next/image|sign-in|r/|.*\\..*).*)"],
}
