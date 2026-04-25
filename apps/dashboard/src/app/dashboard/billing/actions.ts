"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCheckout, createPortal, createTicketCheckout } from "@/lib/api";

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

/**
 * チケット (30 日パス) を購入する。サブスクは増やさず ticket_expires_at のみ延長する。
 * Purchase a one-time ticket (30-day pass). Does not create a subscription.
 * Beli tiket (pass 30 hari) sekali beli. Tidak membuat langganan.
 */
export async function ticketAction(formData: FormData): Promise<void> {
  const passKey = String(formData.get("pass_key") ?? "ticket");

  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session.session?.access_token;
  if (!accessToken) redirect("/login?next=/dashboard/billing");
  const { data: user } = await supabase.auth.getUser();

  const res = await createTicketCheckout(
    {
      passKey,
      successPath: "/dashboard/billing?status=ticket_success",
      cancelPath: "/dashboard/billing?status=ticket_canceled",
      customerEmail: user.user?.email,
    },
    { accessToken },
  );
  redirect(res.url);
}
