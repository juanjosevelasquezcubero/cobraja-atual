/** Resend is optional. Without RESEND_API_KEY the app keeps working and no mail is sent. */
export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendMail(input: { to: string; subject: string; text: string; log: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.warn(`[cobra] ${input.log} sem RESEND_API_KEY; e-mail não enviado`);
    return;
  }
  const from = process.env.RESET_EMAIL_FROM?.trim() || "CobraJá <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!res.ok) console.error(`[cobra] ${input.log}`, res.status);
  } catch (error) {
    console.error(`[cobra] ${input.log}`, error instanceof Error ? error.message : error);
  }
}
