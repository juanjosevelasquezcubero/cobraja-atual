type AuthError = { code?: string | null; message?: string | null } | null | undefined;

export function authErrorMessage(error: AuthError, fallback: string): string {
  const code = error?.code || "";
  if (code === "EMAIL_NOT_VERIFIED") return "Confirme o e-mail antes de entrar. Olhe a caixa de entrada e o spam.";
  if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "INVALID_PASSWORD") return "E-mail ou senha não conferem.";
  if (code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
    return "Esse e-mail já tem conta. Entre ou peça uma nova senha.";
  }
  if (code === "TOO_MANY_REQUESTS") return "Muitas tentativas. Espere um pouco e tente de novo.";
  if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") return "A senha precisa ter entre 6 e 128 caracteres.";
  if (code === "SESSION_EXPIRED") return "Entre de novo e repita. A sessão já não está recente.";
  if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") return "Essa conta não usa senha. Deixe a senha em branco e confirme de novo.";
  return fallback;
}

export function signUpNeedsVerification(result: {
  data?: { user?: { emailVerified?: boolean } | null; token?: string | null } | null;
}): boolean {
  const user = result.data?.user;
  return Boolean(user && user.emailVerified === false && !result.data?.token);
}
