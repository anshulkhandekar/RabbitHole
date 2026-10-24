import { z } from "zod";
const Users = z
  .array(
    z.object({
      owner: z.string().trim().min(1).max(100),
      token: z
        .string()
        .min(32)
        .max(512)
        .refine((v) => !v.startsWith("REPLACE")),
    }),
  )
  .min(1)
  .max(100);
export function getUsers(
  env: Record<string, string | undefined> = process.env,
) {
  try {
    const value = env.RABBITHOLE_USERS
      ? JSON.parse(env.RABBITHOLE_USERS)
      : env.RABBITHOLE_TOKEN
        ? [
            {
              owner: env.RABBITHOLE_OWNER ?? "owner",
              token: env.RABBITHOLE_TOKEN,
            },
          ]
        : [];
    return Users.parse(value);
  } catch {
    // Never include raw environment values in startup errors.
    throw new Error(
      "Configure valid RABBITHOLE_USERS JSON or RABBITHOLE_TOKEN (32+ random characters); see .env.example",
    );
  }
}
