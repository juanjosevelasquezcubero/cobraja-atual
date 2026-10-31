export async function requestPasswordReset(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, error: "Sem internet. A troca de senha precisa de conexão." };
  }
  try {
    const res = await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        redirectTo: `${window.location.origin}/redefinir`,
      }),
    });
    if (!res.ok) return { ok: false, error: "Não foi possível pedir a nova senha. Tente de novo." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Sem internet. A troca de senha precisa de conexão." };
  }
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, error: "Sem internet. A troca de senha precisa de conexão." };
  }
  try {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    if (!res.ok) return { ok: false, error: "Link inválido ou vencido. Peça um novo." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Sem internet. A troca de senha precisa de conexão." };
  }
}
