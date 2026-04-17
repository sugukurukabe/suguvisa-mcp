"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCheckout, createPortal } from "@/lib/api";

export async function upgradeAction(formData: FormData): Promise<void> {
  const priceId = String(formData.get("price_id") ?? "");
  if (!priceId) throw new Error("missing_price_id");

  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session.session?.access_token;
  if (!accessToken) redirect("/login?next=/dashboard/billing");
  const { data: user } = await supabase.auth.getUser();

  const res = await createCheckout(
    {
      priceId,
      successPath: "/dashboard/billing?status=success",
      cancelPath: "/dashboard/billing?status=canceled",
      customerEmail: user.user?.email,
    },
    { accessToken },
  );
  redirect(res.url);
}

export async function manageAction(): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) redirect("/login?next=/dashboard/billing");

  const res = await createPortal({ returnPath: "/dashboard/billing" }, { accessToken });
  redirect(res.url);
}
