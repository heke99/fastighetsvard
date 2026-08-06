import { getBranding } from "@/lib/branding";
import type { MaintenanceStatus } from "@/lib/database-types";
import { cleanEnvValue } from "@/lib/env-value";
import { getMaintenanceStatusLabel } from "@/lib/status-labels";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MaintenanceEmailInput {
  requestId: string;
  requestNumber: string;
  title: string;
  description: string;
  category: string;
  status?: MaintenanceStatus;
  isEmergency: boolean;
  reporterName?: string;
  reporterEmail?: string | null;
  reporterPhone?: string | null;
  location?: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

function emailShell(content: string): string {
  const brand = getBranding();
  return `
    <div style="background:#f5f5f4;padding:32px 16px;font-family:Arial,sans-serif;color:#1c1917">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;overflow:hidden">
        <div style="background:#153d20;padding:20px 24px;color:#ffffff">
          <div style="font-family:Georgia,serif;font-size:24px;letter-spacing:6px">FADDEBO</div>
        </div>
        <div style="padding:28px 24px;line-height:1.6">${content}</div>
        <div style="border-top:1px solid #e7e5e4;padding:16px 24px;font-size:12px;color:#78716c">
          ${escapeHtml(brand.legalDisplayName)}<br />
          Kontakt: <a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:#205541">${escapeHtml(brand.supportEmail)}</a>
        </div>
      </div>
    </div>`;
}

function actionButton(url: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#205541;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">${escapeHtml(label)}</a></p>`;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = cleanEnvValue(process.env.RESEND_API_KEY);
  const configuredFrom = cleanEnvValue(process.env.EMAIL_FROM);
  const from = configuredFrom?.toLowerCase().includes("info@faddebo.se")
    ? configuredFrom
    : "FaddeBo <info@faddebo.se>";

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production" || process.env.EMAIL_LOG_LINKS === "true") {
      console.info(`[email-disabled] to=${input.to} subject=${cleanSubject(input.subject)}`);
      if (input.text) console.info(input.text);
      return;
    }
    throw new Error("RESEND_API_KEY saknas i produktion.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: cleanSubject(input.subject),
      html: input.html,
      text: input.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`E-post kunde inte skickas (${response.status}): ${body}`);
  }
}

export async function sendInvitationEmail(to: string, url: string): Promise<void> {
  const brand = getBranding();
  await sendEmail({
    to,
    subject: `Aktivera ${brand.portalName} hos ${brand.brandName}`,
    text: `Aktivera ditt konto: ${url}`,
    html: emailShell(
      `<p>Hej!</p><p>Du har blivit inbjuden till ${escapeHtml(brand.portalName)} hos ${escapeHtml(brand.brandName)}.</p>${actionButton(url, "Aktivera ditt konto")}<p>Länken gäller i 14 dagar.</p>`
    ),
  });
}

export async function sendStaffAccountEmail(
  to: string,
  url: string,
  roleName: string
): Promise<void> {
  const brand = getBranding();
  await sendEmail({
    to,
    subject: `Ditt ${brand.brandName}-konto är skapat`,
    text: `Ditt konto med rollen ${roleName} är skapat. Välj lösenord: ${url}`,
    html: emailShell(
      `<p>Hej!</p><p>Ett personalkonto med rollen <strong>${escapeHtml(roleName)}</strong> har skapats åt dig hos ${escapeHtml(brand.brandName)}.</p>${actionButton(url, "Välj lösenord")}<p>När lösenordet är sparat kan du logga in och öppna din behörighetsanpassade dashboard.</p><p>Begär en ny länk via Glömt lösenord om länken har gått ut.</p>`
    ),
  });
}

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  const brand = getBranding();
  await sendEmail({
    to,
    subject: `Återställ ditt lösenord hos ${brand.brandName}`,
    text: `Återställ ditt lösenord: ${url}`,
    html: emailShell(
      `<p>Hej!</p><p>En återställning av lösenordet har begärts.</p>${actionButton(url, "Återställ lösenordet")}<p>Länken gäller i en timme. Ignorera mejlet om du inte gjorde begäran.</p>`
    ),
  });
}

export async function sendMaintenanceReceiptEmail(
  to: string,
  input: MaintenanceEmailInput
): Promise<void> {
  const brand = getBranding();
  const url = `${brand.appUrl}/mina-sidor/felanmalan/${input.requestId}`;
  await sendEmail({
    to,
    subject: `Felanmälan #${input.requestNumber} är mottagen`,
    text: `Vi har tagit emot din felanmälan #${input.requestNumber}: ${input.title}. Följ ärendet på ${url}`,
    html: emailShell(
      `<p>Hej${input.reporterName ? ` ${escapeHtml(input.reporterName)}` : ""}!</p>
       <p>Vi har tagit emot din felanmälan och den är nu synlig för ansvarig personal i FaddeBo.</p>
       <p><strong>#${escapeHtml(input.requestNumber)} · ${escapeHtml(input.title)}</strong><br />
       ${escapeHtml(input.location ?? "Allmänt utrymme")} · ${escapeHtml(input.category)}</p>
       ${actionButton(url, "Följ felanmälan på Mina sidor")}
       <p>Du får fortsatt statusinformation i portalen.</p>`
    ),
  });
}

export async function sendMaintenanceInternalAlertEmail(
  to: string,
  input: MaintenanceEmailInput
): Promise<void> {
  const brand = getBranding();
  const url = `${brand.appUrl}/admin/felanmalan`;
  const urgency = input.isEmergency ? "AKUT · " : "";
  await sendEmail({
    to,
    subject: `${urgency}Ny felanmälan #${input.requestNumber}: ${input.title}`,
    text: `Ny felanmälan #${input.requestNumber}\n${input.title}\n${input.description}\n${url}`,
    html: emailShell(
      `<p><strong>${input.isEmergency ? "Akut felanmälan" : "Ny felanmälan"}</strong> har skickats in och finns i personalportalen.</p>
       <p><strong>#${escapeHtml(input.requestNumber)} · ${escapeHtml(input.title)}</strong><br />
       ${escapeHtml(input.location ?? "Allmänt utrymme")} · ${escapeHtml(input.category)}</p>
       <p>${escapeHtml(input.description).replaceAll("\n", "<br />")}</p>
       <p style="font-size:13px;color:#57534e">Anmälare: ${escapeHtml(input.reporterName ?? "Okänd")}${input.reporterEmail ? ` · ${escapeHtml(input.reporterEmail)}` : ""}${input.reporterPhone ? ` · ${escapeHtml(input.reporterPhone)}` : ""}</p>
       ${actionButton(url, "Öppna felanmälningar")}`
    ),
  });
}

export async function sendMaintenanceStatusEmail(
  to: string,
  input: MaintenanceEmailInput
): Promise<void> {
  const brand = getBranding();
  const url = `${brand.appUrl}/mina-sidor/felanmalan/${input.requestId}`;
  const status = input.status
    ? getMaintenanceStatusLabel(input.status, "tenant")
    : "Uppdaterad";
  await sendEmail({
    to,
    subject: `Felanmälan #${input.requestNumber} har status ${status}`,
    text: `Status för felanmälan #${input.requestNumber} är nu ${status}. ${url}`,
    html: emailShell(
      `<p>Hej${input.reporterName ? ` ${escapeHtml(input.reporterName)}` : ""}!</p>
       <p>Status för <strong>#${escapeHtml(input.requestNumber)} · ${escapeHtml(input.title)}</strong> är nu <strong>${escapeHtml(status)}</strong>.</p>
       ${actionButton(url, "Öppna ärendet på Mina sidor")}`
    ),
  });
}