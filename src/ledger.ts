import { db } from "./db.js";

export async function getShadowCashUsd(): Promise<number> {
  const { data: account, error: accountError } = await db
    .from("shadow_accounts")
    .select("id")
    .eq("name", "5K MACHINE - SHADOW")
    .single();

  if (accountError) throw accountError;

  const { data, error } = await db
    .from("transactions")
    .select("side, net_value_usd")
    .eq("account_id", account.id);

  if (error) throw error;

  let cash = 0;
  for (const row of data ?? []) {
    const value = Number(row.net_value_usd);
    if (row.side === "DEPOSIT" || row.side === "SELL") cash += value;
    if (row.side === "BUY" || row.side === "WITHDRAWAL") cash -= value;
  }
  return cash;
}
