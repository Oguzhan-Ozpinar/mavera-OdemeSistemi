import { getRuntimeConfig } from "@/lib/config";

export async function verifyTurnstile(token: string | undefined, ip: string) {
  const config = getRuntimeConfig();

  if (!config.security.turnstileSecretKey) {
    return process.env.NODE_ENV !== "production";
  }

  if (!token) return false;

  const body = new FormData();
  body.append("secret", config.security.turnstileSecretKey);
  body.append("response", token);
  body.append("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body
  });

  if (!response.ok) return false;
  const data = (await response.json()) as { success?: boolean };
  return data.success === true;
}
