import {NextResponse} from "next/server";
import {db,passwordHash,passwordOk} from "@/lib/supabase-admin";

const attempts=new Map<string,{count:number;resetAt:number}>();
const windowMs=15*60*1000,maxAttempts=5;

export async function POST(request:Request){
 try{
  const {teacherId,recoveryKey,newPassword}=await request.json();
  const code=String(teacherId||"").trim().toUpperCase(),password=String(newPassword||"");
  if(!code||!recoveryKey||password.length<4)return NextResponse.json({error:"invalid"},{status:400});
  const client=(request.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim(),key=`${client}:${code}`,now=Date.now(),prior=attempts.get(key);
  if(prior&&prior.resetAt>now&&prior.count>=maxAttempts)return NextResponse.json({error:"too_many_attempts"},{status:429});
  const state=!prior||prior.resetAt<=now?{count:0,resetAt:now+windowMs}:prior;
  const teacher=(await db(`teachers?teacher_code=eq.${encodeURIComponent(code)}&select=id,recovery_hash`))[0];
  if(!teacher||!passwordOk(String(recoveryKey).trim().toUpperCase(),teacher.recovery_hash)){
   attempts.set(key,{...state,count:state.count+1});
   return NextResponse.json({error:"unauthorized"},{status:401});
  }
  await db(`teachers?id=eq.${teacher.id}`,{method:"PATCH",body:JSON.stringify({password_hash:passwordHash(password)})});
  attempts.delete(key);
  return NextResponse.json({ok:true});
 }catch(error){
  console.error("teacher recovery failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}
