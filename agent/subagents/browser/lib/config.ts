/**
 * Environment configuration for the browser worker. Read lazily, on first
 * browser use, so the agent still builds and starts without a Kernel key.
 */
export interface BrowserConfig {
  readonly apiKey: string;
  /** The one persistent Kernel profile that holds the owner's logins. */
  readonly profileName: string;
  readonly stealth: boolean;
}

export const DEFAULT_PROFILE = "steward-owner";

// Kernel's rule for profile names: 1-255 letters, numbers, dots, underscores, hyphens.
const PROFILE_NAME = /^[A-Za-z0-9._-]{1,255}$/;

export function readConfig(env: Readonly<Record<string, string | undefined>> = process.env): BrowserConfig {
  const apiKey = env.KERNEL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("KERNEL_API_KEY is not set, so the browser worker cannot start a Kernel browser.");
  }

  const profileName = env.KERNEL_PROFILE?.trim() || DEFAULT_PROFILE;
  if (!PROFILE_NAME.test(profileName)) {
    throw new Error("KERNEL_PROFILE must be 1-255 letters, numbers, dots, underscores or hyphens.");
  }

  // Stealth also switches on Kernel's CAPTCHA solver, so it is an explicit opt-in.
  return { apiKey, profileName, stealth: env.KERNEL_STEALTH?.trim() === "true" };
}
