import {NextResponse} from "next/server";
import {SupabaseRequestError,db,generateQrToken,passwordHash,passwordOk,sha256} from "@/lib/supabase-admin";

async function uniqueQrToken(){
 for(let attempt=0;attempt<8;attempt++){
  const token=generateQrToken();
  const hash=sha256(token);
  const collision=(await db(`student_access_credentials?qr_token_hash=eq.${hash}&select=student_id`))[0];
  if(!collision)return {token,hash};
 }
 throw new Error("Unable to allocate a unique QR token");
}

export async function POST(request:Request){
 let stage="request";
 try{
  const body=await request.json();
  const {teacherId,password,recoveryKey,classData,students=[],credentials=[],moods=[]}=body;
  if(!teacherId||!password||!recoveryKey||!classData?.id||!classData?.classCode)return NextResponse.json({error:"invalid_request"},{status:400});

  stage="teacher";
  let teacher=(await db(`teachers?teacher_code=eq.${encodeURIComponent(teacherId)}&select=*`))[0];
  if(!teacher)teacher=(await db("teachers",{method:"POST",body:JSON.stringify({teacher_code:teacherId,password_hash:passwordHash(password),recovery_hash:passwordHash(recoveryKey)})}))[0];
  else if(!passwordOk(password,teacher.password_hash)){
   if(!passwordOk(recoveryKey,teacher.recovery_hash))return NextResponse.json({error:"unauthorized",stage:"teacher_auth"},{status:401});
   teacher=(await db(`teachers?id=eq.${teacher.id}`,{method:"PATCH",body:JSON.stringify({password_hash:passwordHash(password)})}))[0];
  }

  stage="class";
  let cls=(await db(`classes?external_id=eq.${encodeURIComponent(classData.id)}&select=*`))[0];
  if(cls){
   const membership=(await db(`teacher_class_memberships?teacher_id=eq.${teacher.id}&class_id=eq.${cls.id}&select=teacher_id`))[0];
   if(!membership)return NextResponse.json({error:"forbidden"},{status:403});
   cls=(await db(`classes?id=eq.${cls.id}`,{method:"PATCH",body:JSON.stringify({name:classData.name,feature_settings:classData.features||{}})}))[0];
  }else{
   cls=(await db("classes",{method:"POST",body:JSON.stringify({external_id:classData.id,name:classData.name,class_code:classData.classCode,feature_settings:classData.features||{}})}))[0];
   await db("teacher_class_memberships",{method:"POST",body:JSON.stringify({teacher_id:teacher.id,class_id:cls.id})});
  }

  stage="students";
  const idMap=new Map<string,string>();
  for(const studentInput of students){
   let student=(await db(`students?external_id=eq.${encodeURIComponent(studentInput.id)}&select=*`))[0];
   if(student&&student.class_id!==cls.id)return NextResponse.json({error:"student_class_conflict"},{status:409});
   student=student
    ?(await db(`students?id=eq.${student.id}`,{method:"PATCH",body:JSON.stringify({name:studentInput.name,avatar:studentInput.avatar,active:studentInput.active})}))[0]
    :(await db("students",{method:"POST",body:JSON.stringify({external_id:studentInput.id,class_id:cls.id,name:studentInput.name,avatar:studentInput.avatar,active:studentInput.active})}))[0];
   idMap.set(studentInput.id,student.id);
  }

  stage="student_access_credentials";
  const issuedQrTokens:{studentId:string;qrToken:string;version:number}[]=[];
  for(const credentialInput of credentials){
   const studentId=idMap.get(credentialInput.studentId);
   if(!studentId)continue;
   const existing=(await db(`student_access_credentials?student_id=eq.${studentId}&select=student_id,student_code,token_version`))[0];
   if(!existing){
    const qr=await uniqueQrToken();
    const version=Math.max(1,Number(credentialInput.version)||1);
    await db("student_access_credentials",{method:"POST",body:JSON.stringify({student_id:studentId,student_code:credentialInput.studentCode,pin_hash:passwordHash(String(credentialInput.pin)),qr_token_hash:qr.hash,qr_active:true,token_version:version})});
    issuedQrTokens.push({studentId:credentialInput.studentId,qrToken:qr.token,version});
   }else{
    const requestedVersion=Math.max(1,Number(credentialInput.version)||1);
    const update:Record<string,unknown>={student_code:credentialInput.studentCode,pin_hash:passwordHash(String(credentialInput.pin)),updated_at:new Date().toISOString()};
    if(requestedVersion>existing.token_version){
     const qr=await uniqueQrToken();
     update.qr_token_hash=qr.hash;
     update.qr_active=true;
     update.token_version=requestedVersion;
     issuedQrTokens.push({studentId:credentialInput.studentId,qrToken:qr.token,version:requestedVersion});
    }
    await db(`student_access_credentials?student_id=eq.${studentId}`,{method:"PATCH",body:JSON.stringify(update)});
   }
  }

  stage="daily_moods";
  for(const mood of moods){
   const studentId=idMap.get(mood.ownerId);
   if(!studentId)continue;
   const existing=(await db(`daily_moods?external_id=eq.${encodeURIComponent(mood.id)}&select=class_id,student_id`))[0];
   if(existing&&(existing.class_id!==cls.id||existing.student_id!==studentId))return NextResponse.json({error:"activity_owner_conflict"},{status:409});
   await db("daily_moods?on_conflict=external_id",{method:"POST",body:JSON.stringify({external_id:mood.id,class_id:cls.id,student_id:studentId,emoji_a:mood.a,emoji_b:mood.b,note:mood.note||"",privacy_level:mood.privacyLevel,activity_date:new Date(mood.createdAt).toISOString().slice(0,10),created_at:new Date(mood.createdAt).toISOString()})});
  }

  return NextResponse.json({ok:true,issuedQrTokens});
 }catch(error){
  const detail=error instanceof SupabaseRequestError?{stage,table:error.table,status:error.status,code:error.code,message:error.message}:{stage,table:"unknown",status:500,code:"unknown",message:error instanceof Error?error.message:"unknown"};
  console.error("cloud sync failed",detail);
  return NextResponse.json({error:"cloud_unavailable",stage:detail.stage,table:detail.table,status:detail.status,code:detail.code},{status:503});
 }
}
