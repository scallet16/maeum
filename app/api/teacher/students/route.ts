import {cookies} from "next/headers";
import {randomInt,randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {SupabaseRequestError,db,generateQrToken,passwordHash,passwordOk,sha256,verifiedTeacher,verifyStudentSession} from "@/lib/supabase-admin";

const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code=()=>Array.from({length:7},()=>alphabet[randomInt(0,alphabet.length)]).join("");
const pin=()=>String(randomInt(0,10000)).padStart(4,"0");

async function teacherClass(externalId:string){
 const jar=await cookies();
 if(verifyStudentSession(jar.get("maeum_student_session")?.value||""))return null;
 const identity=await verifiedTeacher(jar.get("maeum_teacher_session")?.value||"");
 if(!identity)return null;
 const cls=(await db(`classes?external_id=eq.${encodeURIComponent(externalId)}&select=id,external_id`))[0];
 if(!cls)return null;
 const membership=(await db(`teacher_class_memberships?teacher_id=eq.${identity.teacher.id}&class_id=eq.${cls.id}&select=teacher_id`))[0];
 return membership?{teacher:identity.teacher,cls}:null;
}

async function uniqueStudentCode(){
 for(let attempt=0;attempt<8;attempt++){
  const value=code();
  if(!(await db(`student_access_credentials?student_code=eq.${value}&select=student_id`))[0])return value;
 }
 throw new Error("student code unavailable");
}

async function uniqueQr(){
 for(let attempt=0;attempt<8;attempt++){
  const token=generateQrToken(),hash=sha256(token);
  if(!(await db(`student_access_credentials?qr_token_hash=eq.${hash}&select=student_id`))[0])return {token,hash};
 }
 throw new Error("QR token unavailable");
}

export async function POST(request:Request){
 let createdStudentId="";
 try{
  const {classId,name="새 원아",avatar="🐻"}=await request.json();
  const access=await teacherClass(String(classId||""));
  if(!access)return NextResponse.json({error:"unauthorized"},{status:401});
  const active=await db(`students?class_id=eq.${access.cls.id}&active=eq.true&select=id`);
  if(active.length>=25)return NextResponse.json({error:"class_full"},{status:409});
  const externalId=`student-${randomUUID()}`;
  const student=(await db("students",{method:"POST",body:JSON.stringify({external_id:externalId,class_id:access.cls.id,name:String(name).trim().slice(0,40)||"새 원아",avatar:String(avatar).slice(0,8)||"🐻",active:true})}))[0];
  createdStudentId=student.id;
  for(let attempt=0;attempt<8;attempt++){
   const studentCode=await uniqueStudentCode(),initialPin=pin(),qr=await uniqueQr();
   try{
    await db("student_access_credentials",{method:"POST",body:JSON.stringify({student_id:student.id,student_code:studentCode,pin_hash:passwordHash(initialPin),qr_token_hash:qr.hash,qr_active:true,token_version:1})});
    const credential=(await db(`student_access_credentials?student_id=eq.${student.id}&select=student_id,student_code,pin_hash,qr_token_hash,qr_active,token_version`))[0];
    if(credential?.student_code!==studentCode||!passwordOk(initialPin,credential?.pin_hash||"")||credential?.qr_token_hash!==qr.hash||!credential?.qr_active)throw new Error("student credential verification failed");
    return NextResponse.json({ok:true,student:{id:externalId,name:student.name,avatar:student.avatar,active:true,attendance:"present"},credential:{studentId:externalId,studentCode,initialPin,qrToken:qr.token,version:credential.token_version}});
   }catch(error){
    if(error instanceof SupabaseRequestError&&error.code==="23505")continue;
    throw error;
   }
  }
  throw new Error("student credential unavailable");
 }catch(error){
  if(createdStudentId){
   try{await db(`students?id=eq.${encodeURIComponent(createdStudentId)}`,{method:"DELETE"})}catch(rollbackError){console.error("student registration rollback failed",rollbackError instanceof Error?rollbackError.message:"unknown")}
  }
  console.error("student registration failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"student_registration_unavailable"},{status:503});
 }
}

export async function PATCH(request:Request){
 try{
  const {classId,studentId,action}=await request.json();
  const access=await teacherClass(String(classId||""));
  if(!access)return NextResponse.json({error:"unauthorized"},{status:401});
  const student=(await db(`students?external_id=eq.${encodeURIComponent(String(studentId||""))}&class_id=eq.${access.cls.id}&select=id,external_id`))[0];
  if(!student)return NextResponse.json({error:"not_found"},{status:404});
  const credential=(await db(`student_access_credentials?student_id=eq.${student.id}&select=student_id,student_code,pin_hash,token_version`))[0];
  if(!credential)return NextResponse.json({error:"not_found"},{status:404});
  if(action==="reset_pin"){
   let initialPin=pin();while(passwordOk(initialPin,credential.pin_hash))initialPin=pin();
   await db(`student_access_credentials?student_id=eq.${student.id}`,{method:"PATCH",body:JSON.stringify({pin_hash:passwordHash(initialPin),updated_at:new Date().toISOString()})});
   return NextResponse.json({ok:true,studentCode:credential.student_code,initialPin});
  }
  if(action==="reset_qr"){
   for(let attempt=0;attempt<8;attempt++){
    const qr=await uniqueQr(),version=Number(credential.token_version)+1;
    try{await db(`student_access_credentials?student_id=eq.${student.id}`,{method:"PATCH",body:JSON.stringify({qr_token_hash:qr.hash,qr_active:true,token_version:version,updated_at:new Date().toISOString()})});return NextResponse.json({ok:true,studentCode:credential.student_code,qrToken:qr.token,version})}
    catch(error){if(!(error instanceof SupabaseRequestError)||error.code!=="23505")throw error}
   }
   throw new Error("QR token unavailable");
  }
  return NextResponse.json({error:"invalid_action"},{status:400});
 }catch(error){
  console.error("student credential reset failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"credential_update_unavailable"},{status:503});
 }
}
