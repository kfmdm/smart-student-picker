import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyToken } from "./auth";

// Server-seitiger Auth-Check anhand des httpOnly-Cookies.
export async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyToken(cookieStore.get(ADMIN_COOKIE)?.value);
}
