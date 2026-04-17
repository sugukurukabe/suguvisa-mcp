"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { issueApiKey as issueRemote, revokeApiKey as revokeRemote } from "@/lib/api";

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Issue a new API key via the MCP server.
 * 新しい API キーを発行する / Terbitkan kunci API baru.
 *
 * Returns the one-time full token. Only a label is sent; the raw key
 * is stored server-side and shown to the user just once.
 */
export async function issueApiKey(formData: FormData): Promise<{ token: string } | { error: string }> {
  const label = String(formData.get("label") ?? "").trim().slice(0, 60) || "default";
  const accessToken = await getAccessToken();
  if (!accessToken) return { error: "not_authenticated" };
  try {
    const { token } = await issueRemote({ label }, { accessToken });
    revalidatePath("/dashboard/api-keys");
    return { token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("not_authenticated");
  await revokeRemote(id, { accessToken });
  revalidatePath("/dashboard/api-keys");
}
