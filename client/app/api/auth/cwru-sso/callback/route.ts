/**
 * GET /api/auth/cwru-sso/callback
 * CWRU CAS ticket callback. Validates ticket, upserts the user, issues tokens,
 * and redirects to home.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSSOCallbackUrl, validateCWRUTicket } from "@/lib/auth/cwru-sso";
import { generateAccessToken } from "@/lib/auth/jwt";
import { generateRefreshToken, createRefreshToken } from "@/lib/auth/tokens";
import { setAuthCookies } from "@/lib/auth/cookies";

function loginRedirectWithError(request: NextRequest, error: string) {
  const url = new URL("/auth/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticket = searchParams.get("ticket");

    if (!ticket) {
      return loginRedirectWithError(request, "missing_ticket");
    }

    // The `service` value must match exactly what was sent to /cas/login.
    // Rebuild from the origin + path — strip query string.
    const serviceUrl = getSSOCallbackUrl(request.url);

    const result = await validateCWRUTicket(ticket, serviceUrl);
    if (!result.success || !result.userInfo) {
      return loginRedirectWithError(
        request,
        result.error || "sso_validation_failed"
      );
    }

    const { mail, givenName, sn, studentId } = result.userInfo;
    const email = mail.toLowerCase();

    // Upsert user keyed by email. For existing OTP users this attaches their
    // SSO identity without disrupting their account. For new users it creates
    // the account directly (email is considered verified via SSO).
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let userRecord;
    if (existing.length === 0) {
      const [created] = await db
        .insert(users)
        .values({
          email,
          firstName: givenName || null,
          lastName: sn || null,
          authProvider: "cwru_sso",
          authProviderMetadata: { studentId },
          roles: ["user"],
        })
        .returning();
      userRecord = created;
    } else {
      const current = existing[0];
      const [updated] = await db
        .update(users)
        .set({
          // Fill in name from SSO if we don't have it yet; never overwrite
          // values the user has already set.
          firstName: current.firstName ?? (givenName || null),
          lastName: current.lastName ?? (sn || null),
          authProvider: "cwru_sso",
          authProviderMetadata: {
            ...(typeof current.authProviderMetadata === "object" &&
            current.authProviderMetadata !== null
              ? current.authProviderMetadata
              : {}),
            studentId,
          },
          updatedAt: new Date(),
        })
        .where(eq(users.id, current.id))
        .returning();
      userRecord = updated;
    }

    const accessToken = await generateAccessToken(
      userRecord.id,
      userRecord.email,
      userRecord.roles as string[],
      userRecord.firstName || undefined,
      userRecord.lastName || undefined
    );
    const refreshToken = generateRefreshToken();
    await createRefreshToken(userRecord.id, refreshToken);

    const response = NextResponse.redirect(new URL("/", request.url));
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (error) {
    console.error("CWRU SSO callback error:", error);
    return loginRedirectWithError(request, "sso_error");
  }
}
