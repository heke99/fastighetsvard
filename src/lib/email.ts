import { getBranding } from "@/lib/branding";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
          ${brand.legalDisplayName}<br />
          Kontakt: <a href="mailto:${brand.supportEmail}" style="color:#205541">${brand.supportEmail}</a>
        </div>
      </div>
    </div>`;
}

function actionButton(url: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#205541;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">${label}</a></p>`;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const configuredFrom = process.env.EMAIL_FROM?.trim();
  const from = configuredFrom?.toLowerCase().includes("info@faddebo.se")
    ? configuredFrom
    : "FaddeBo <info@faddebo.se>";

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production" || process.env.EMAIL_LOG_LINKS === "true") {
      console.info(`[email-disabled] to=${input.to} subject=${input.subject}`);
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
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
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
      `<p>Hej!</p><p>Du har blivit inbjuden till ${brand.portalName} hos ${brand.brandName}.</p>${actionButton(url, "Aktivera ditt konto")}<p>Länken gäller i 14 dagar.</p>`
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
      `<p>Hej!</p><p>Ett personalkonto med rollen <strong>${roleName}</strong> har skapats åt dig hos ${brand.brandName}.</p>${actionButton(url, "Välj lösenord")}<p>När lösenordet är sparat kan du logga in och öppna din behörighetsanpassade dashboard.</p><p>Begär en ny länk via Glömt lösenord om länken har gått ut.</p>`
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
