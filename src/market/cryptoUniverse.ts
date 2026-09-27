export const CRYPTO_UNIVERSE=["BTC","ETH","XRP","SOL","ADA","DOGE","AVAX","LINK"] as const;
export type CryptoAsset=typeof CRYPTO_UNIVERSE[number];
export type UniverseTick={asset:CryptoAsset;market:string;priceUsd:number;observedAt:string;source:string};
const endpoint=(a:string)=>`https://api.coinbase.com/v2/prices/${a}-USD/spot`;
export async function fetchUniverse():Promise<UniverseTick[]>{
 const observedAt=new Date().toISOString();
 const settled=await Promise.allSettled(CRYPTO_UNIVERSE.map(async asset=>{
  const url=endpoint(asset);const r=await fetch(url,{headers:{"User-Agent":"5k-machine/0.1"}});
  if(!r.ok)throw new Error(`${asset} HTTP ${r.status}`);
  const j=await r.json() as any;const priceUsd=Number(j?.data?.amount);
  if(!Number.isFinite(priceUsd)||priceUsd<=0)throw new Error(`${asset} invalid price`);
  return {asset,market:`${asset}-USD`,priceUsd,observedAt,source:url} as UniverseTick;
 }));
 return settled.flatMap(x=>x.status==="fulfilled"?[x.value]:[]);
}
