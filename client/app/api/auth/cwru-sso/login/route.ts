/**
 * GET /api/auth/cwru-sso/login
 * Redirect the user to CWRU CAS login page.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateCWRUSSOLoginURL } from "@/lib/auth/cwru-sso";

export async function GET(request: NextRequest) {
  const loginUrl = generateCWRUSSOLoginURL(request.url);
  return NextResponse.redirect(loginUrl);
}
