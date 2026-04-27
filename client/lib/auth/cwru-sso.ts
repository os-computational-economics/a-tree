/**
 * CWRU Single Sign-On (CAS 2.0) utilities
 * CAS server: https://login.case.edu/cas
 */

const CAS_BASE_URL = "https://login.case.edu/cas";
const SSO_CALLBACK_PATH = "/api/auth/cwru-sso/callback";

export interface CWRUUserInfo {
  /** Primary email, typically <networkid>@case.edu (from <cas:mail>) */
  mail: string;
  /** First name (from <cas:givenName>) */
  givenName: string;
  /** Surname (from <cas:sn>) */
  sn: string;
  /** CWRU Network ID (from <cas:user>) — stable primary identifier */
  studentId: string;
}

export interface ValidateTicketResult {
  success: boolean;
  userInfo?: CWRUUserInfo;
  error?: string;
}

/**
 * Build the absolute callback URL used as the CAS `service` parameter.
 * The same string must be used at /cas/login and /cas/serviceValidate.
 */
export function getSSOCallbackUrl(requestUrl: string): string {
  const origin = new URL(requestUrl).origin;
  return `${origin}${SSO_CALLBACK_PATH}`;
}

/** Build the URL to redirect the browser to for CWRU SSO login. */
export function generateCWRUSSOLoginURL(requestUrl: string): string {
  const callbackUrl = getSSOCallbackUrl(requestUrl);
  return `${CAS_BASE_URL}/login?service=${encodeURIComponent(callbackUrl)}`;
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<cas:${tag}>([\\s\\S]*?)<\\/cas:${tag}>`));
  return match ? match[1].trim() : undefined;
}

/**
 * Validate a CAS ticket server-side and extract user info.
 * `serviceUrl` must match exactly the `service` param used at /cas/login.
 */
export async function validateCWRUTicket(
  ticket: string,
  serviceUrl: string
): Promise<ValidateTicketResult> {
  try {
    const params = new URLSearchParams({ ticket, service: serviceUrl });
    const response = await fetch(
      `${CAS_BASE_URL}/serviceValidate?${params.toString()}`
    );
    const xmlText = await response.text();

    if (xmlText.includes("<cas:authenticationFailure")) {
      const m = xmlText.match(
        /<cas:authenticationFailure[^>]*>([\s\S]*?)<\/cas:authenticationFailure>/
      );
      return {
        success: false,
        error: m ? m[1].trim() : "Authentication failed",
      };
    }

    if (!xmlText.includes("<cas:authenticationSuccess")) {
      return { success: false, error: "Authentication failed" };
    }

    const studentId = extractTag(xmlText, "user") ?? "";
    if (!studentId) {
      return { success: false, error: "Student ID not found" };
    }

    const userInfo: CWRUUserInfo = {
      studentId,
      mail: extractTag(xmlText, "mail") ?? "",
      givenName: extractTag(xmlText, "givenName") ?? "",
      sn: extractTag(xmlText, "sn") ?? "",
    };

    if (!userInfo.mail) {
      return { success: false, error: "Email not released by CAS" };
    }

    return { success: true, userInfo };
  } catch (error) {
    console.error("Error validating CWRU ticket:", error);
    return { success: false, error: "Failed to validate ticket" };
  }
}
