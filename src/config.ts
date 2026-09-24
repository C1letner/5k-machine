import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const config = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  btcPriceUrl:
    process.env.BTC_PRICE_URL ??
    "https://api.coinbase.com/v2/prices/BTC-USD/spot",
};
