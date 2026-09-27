import { spawn } from "node:child_process";
const stages=[
 ["universe","src/universeWorker.ts"],
 ["discovery-test","src/hypothesisTester.ts"],
 ["adversarial","src/scientificPipeline.ts"],
 ["holdout","src/replicationLab.ts"],
 ["forward","src/forwardLab.ts"]
] as const;
async function run(name:string,file:string){
 return await new Promise<void>((resolve,reject)=>{
  const p=spawn(process.execPath,["--import","tsx",file],{stdio:"inherit",env:process.env});
  p.on("exit",code=>code===0?resolve():reject(new Error(`${name} exited ${code}`)));
  p.on("error",reject);
 });
}
async function main(){for(const [name,file] of stages){console.log(`STAGE_START ${name}`);await run(name,file);console.log(`STAGE_SUCCESS ${name}`)}console.log(JSON.stringify({ok:true,build:"020",pipeline:"scientific",authorizedToTrade:false}))}
main().catch(e=>{console.error(e);process.exitCode=1});
