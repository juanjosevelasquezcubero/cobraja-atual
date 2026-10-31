import { wipeSellerData } from "@/lib/cobra/wipe.server";
import { mailerConfigured, sendMail } from "./mailer.server";

type MailUser = { email: string; name?: string | null };

function greeting(user: MailUser): string {
  const name = (user.name || "").trim();
  return name ? `Olá, ${name}.` : "Olá.";
}

/** Sends the Better Auth reset link. No-ops (without throwing) when e-mail is not configured. */
export async function sendResetPassword({ user, url }: { user: MailUser; url: string; token: string }): Promise<void> {
  const text = [greeting(user), "", "Para criar uma nova senha no CobraJá, abra o link abaixo. Ele vale por 1 hora.", url, "", "Se você não pediu isso, ignore este e-mail."].join("\n");
  await sendMail({ to: user.email, subject: "Nova senha do CobraJá", text, log: "falha ao enviar e-mail de senha" });
}

async function sendVerificationEmail({ user, url }: { user: MailUser; url: string; token: string }): Promise<void> {
  const text = [
    greeting(user),
    "",
    "Confirme este e-mail para entrar no CobraJá. O link vale por 24 horas.",
    url,
    "",
    "Se você não criou a conta, ignore este e-mail.",
  ].join("\n");
  await sendMail({ to: user.email, subject: "Confirme seu e-mail no CobraJá", text, log: "falha ao enviar confirmação" });
}

const mailOn = mailerConfigured();

export const emailAndPasswordOptions = {
  enabled: true as const,
  minPasswordLength: 6,
  maxPasswordLength: 128,
  resetPasswordTokenExpiresIn: 60 * 60,
  revokeSessionsOnPasswordReset: true,
  requireEmailVerification: mailOn,
  autoSignIn: true,
  sendResetPassword,
};

export const emailVerificationOptions = {
  sendOnSignUp: mailOn,
  sendOnSignIn: mailOn,
  autoSignInAfterVerification: true,
  expiresIn: 60 * 60 * 24,
  sendVerificationEmail,
};

export const userOptions = {
  deleteUser: {
    enabled: true,
    beforeDelete: async (user: { id: string }) => {
      await wipeSellerData(user.id);
    },
  },
};

export const rateLimitOptions = {
  enabled: true,
  window: 60,
  max: 60,
  storage: "memory" as const,
  customRules: {
    "/sign-up/email": { window: 60 * 60, max: 8 },
    "/sign-in/email": { window: 10 * 60, max: 20 },
    "/request-password-reset": { window: 60 * 60, max: 5 },
    "/send-verification-email": { window: 60 * 60, max: 5 },
    "/delete-user": { window: 60 * 60, max: 5 },
  },
};
