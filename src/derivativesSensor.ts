import{db}from "./db.js";
const PRODUCTS=(process.env.DERIVATIVE_PRODUCTS??"").split(",").map(x=>x.trim()).filter(Boolean);
async function main(){if(!PRODUCTS.length){console.log(JSON.stringify({ok:true,build:"038",mode:"SCHEMA_AND_LIBRARY_READY",message:"No derivatives products configured. Sensor remains dormant until a verified venue/data adapter is configured.",authorizedToTrade:false},null,2));return}
 throw new Error("DERIVATIVE_PRODUCTS configured but no verified venue adapter is installed; refusing to fabricate derivatives data.");
}
main().catch(e=>{console.error(e);process.exitCode=1});
