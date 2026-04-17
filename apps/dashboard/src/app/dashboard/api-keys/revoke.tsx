"use client";

import { useTransition } from "react";
import { revokeApiKeyAction } from "./actions";

export function RevokeButton({ keyId }: { keyId: string }) {
  const [pending, start] = useTransition();

  return (
    <form
      action={(formData) => {
        if (!confirm("このキーを失効しますか？すぐに MCP サーバーから拒否されます。")) return;
        start(() => revokeApiKeyAction(formData));
      }}
    >
      <input type="hidden" name="id" value={keyId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:hover:bg-rose-900/30"
      >
        {pending ? "失効中…" : "失効"}
      </button>
    </form>
  );
}
