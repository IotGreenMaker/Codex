/**
 * Environment variable validation
 * Ensures required env vars are present at runtime
 */

const requiredServerEnv = [
  "GROQ_API_KEY",
];

const requiredPublicEnv: string[] = [];

export function validateEnv() {
  const missing: string[] = [];

  // Check server-side env vars (only on server)
  if (typeof window === "undefined") {
    for (const key of requiredServerEnv) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
  }

  // Check public env vars (available on client)
  for (const key of requiredPublicEnv) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      `Please check your .env.local file.`
    );
  }
}