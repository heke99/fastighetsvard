interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production" || process.env.EMAIL_LOG_LINKS === "true") {
      console.info(`[email-disabled] to=${input.to} subject=${input.subject}`);
      if (input.text) console.info(input.text);
      return;
    }
    throw new Error("RESEND_API_KEY eller EMAIL_FROM saknas i produktion.");
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
  await sendEmail({
    to,
    subject: "Aktivera Mina sidor hos Östgöta El Teknik",
    text: `Aktivera ditt konto: ${url}`,
    html: `<p>Hej!</p><p>Du har blivit inbjuden till Mina sidor hos Östgöta El Teknik.</p><p><a href="${url}">Aktivera ditt konto</a></p><p>Länken gäller i 14 dagar.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Återställ ditt lösenord",
    text: `Återställ ditt lösenord: ${url}`,
    html: `<p>Hej!</p><p>En återställning av lösenordet har begärts.</p><p><a href="${url}">Återställ lösenordet</a></p><p>Länken gäller i en timme. Ignorera mejlet om du inte gjorde begäran.</p>`,
  });
}
