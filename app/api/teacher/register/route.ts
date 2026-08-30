import {randomInt,randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {SupabaseRequestError,db,passwordHash,passwordOk} from "@/lib/supabase-admin";

const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const defaultFeatures={mood:true,friend:true,nature:true,capture:true,discovery:true,treasure:true,galleryReaction:true,teacherLetter:true};

function part(length:number){
 return Array.from({length},()=>alphabet[randomInt(0,alphabet.length)]).join("");
}

async function available(table:string,column:string,value:string){
 return !(await db(`${table}?${column}=eq.${encodeURIComponent(value)}&select=${column}`))[0];
}

async function rollbackRegistration(teacherId:string,classId:string){
 if(classId)await db(`classes?id=eq.${encodeURIComponent(classId)}`,{method:"DELETE"});
 if(teacherId)await db(`teachers?id=eq.${encodeURIComponent(teacherId)}`,{method:"DELETE"});
 const [teacher,classRow]=await Promise.all([
  teacherId?db(`teachers?id=eq.${encodeURIComponent(teacherId)}&select=id`):[],
  classId?db(`classes?id=eq.${encodeURIComponent(classId)}&select=id`):[]
 ]);
 if(teacher[0]||classRow[0])throw new Error("registration rollback failed");
}

export async function POST(request:Request){
 let createdTeacherId="",createdClassId="";
 try{
  const {className}=await request.json();
  const name=String(className||"").trim();
  if(!name||name.length>80)return NextResponse.json({error:"invalid_class_name"},{status:400});

  for(let attempt=0;attempt<8;attempt++){
   const teacherCode=part(8),initialPassword=String(randomInt(0,1_000_000_000)).padStart(9,"0");
   const classCode=`${part(4)}-${part(4)}`,recoveryKey=`${part(4)}-${part(4)}-${part(4)}`,externalId=`class-${randomUUID()}`;
   const [teacherFree,classCodeFree,externalFree]=await Promise.all([
    available("teachers","teacher_code",teacherCode),
    available("classes","class_code",classCode),
    available("classes","external_id",externalId)
   ]);
   if(!teacherFree||!classCodeFree||!externalFree)continue;

   try{
    const teacher=(await db("teachers",{method:"POST",body:JSON.stringify({teacher_code:teacherCode,password_hash:passwordHash(initialPassword),recovery_hash:passwordHash(recoveryKey)})}))[0];
    createdTeacherId=teacher.id;
    const cls=(await db("classes",{method:"POST",body:JSON.stringify({external_id:externalId,name,class_code:classCode,feature_settings:defaultFeatures})}))[0];
    createdClassId=cls.id;
    await db("teacher_class_memberships",{method:"POST",body:JSON.stringify({teacher_id:teacher.id,class_id:cls.id})});

    const [savedTeacher,savedClass,savedMembership]=await Promise.all([
     db(`teachers?id=eq.${encodeURIComponent(teacher.id)}&teacher_code=eq.${encodeURIComponent(teacherCode)}&select=id,teacher_code,password_hash,recovery_hash`),
     db(`classes?id=eq.${encodeURIComponent(cls.id)}&external_id=eq.${encodeURIComponent(externalId)}&select=id,external_id,name,class_code,feature_settings`),
     db(`teacher_class_memberships?teacher_id=eq.${encodeURIComponent(teacher.id)}&class_id=eq.${encodeURIComponent(cls.id)}&select=teacher_id,class_id`)
    ]);
    if(!passwordOk(initialPassword,savedTeacher[0]?.password_hash||"")||!passwordOk(recoveryKey,savedTeacher[0]?.recovery_hash||"")||savedClass[0]?.class_code!==classCode||!savedMembership[0])throw new Error("registration verification failed");

    return NextResponse.json({ok:true,teacherCode,initialPassword,recoveryKey,classData:{id:externalId,name,classCode,features:defaultFeatures}});
   }catch(error){
    if(createdTeacherId||createdClassId)await rollbackRegistration(createdTeacherId,createdClassId);
    createdTeacherId="";createdClassId="";
    if(error instanceof SupabaseRequestError&&error.code==="23505")continue;
    throw error;
   }
  }
  return NextResponse.json({error:"unique_value_unavailable"},{status:503});
 }catch(error){
  console.error("teacher registration failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"registration_unavailable"},{status:503});
 }
}
