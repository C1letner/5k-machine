import { db } from "./db.js";
async function main(){
 const {data:e,error}=await db.from("company_economics").select("*").single();if(error)throw error;
 const findings:any[]=[];
 if(Number(e.unverified_cost_items)>0)findings.push({severity:"MEDIUM",finding:`${e.unverified_cost_items} cost items await verification.`});
 if(Number(e.unverified_revenue_items)>0)findings.push({severity:"HIGH",finding:`${e.unverified_revenue_items} revenue items await verification; do not include in net profit.`});
 const summary={verifiedRevenueUsd:Number(e.verified_revenue_usd),verifiedCostUsd:Number(e.verified_cost_usd),verifiedNetProfitUsd:Number(e.verified_net_profit_usd),infrastructureUsd:Number(e.infrastructure_usd),aiModelUsd:Number(e.ai_model_usd),marketDataUsd:Number(e.market_data_usd),softwareApiUsd:Number(e.software_api_usd),executionFrictionUsd:Number(e.execution_friction_usd),findings,authorizedToTrade:false};
 console.log(JSON.stringify({ok:true,build:"025",economics:summary},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
