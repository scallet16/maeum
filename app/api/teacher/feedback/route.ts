import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,verifiedTeacher,verifyStudentSession} from "@/lib/supabase-admin";

const allowedKinds=new Set(["mood","capture","discovery"]);

export async function POST(request:Request){
 try{
  if(verifyStudentSession((await cookies()).get("maeum_student_session")?.value||""))return NextResponse.json({error:"forbidden"},{status:403});
  const identity=await verifiedTeacher((await cookies()).get("maeum_teacher_session")?.value||"");
  if(!identity)return NextResponse.json({error:"forbidden"},{status:403});
  const body=await request.json();
  const classExternalId=String(body.classId||"");
  const studentExternalId=String(body.studentId||"");
  const cls=(await db(`classes?external_id=eq.${encodeURIComponent(classExternalId)}&select=id`))[0];
  if(!cls)return NextResponse.json({error:"missing_class"},{status:404});
  const membership=(await db(`teacher_class_memberships?teacher_id=eq.${identity.teacher.id}&class_id=eq.${cls.id}&select=teacher_id`))[0];
  if(!membership)return NextResponse.json({error:"forbidden"},{status:403});
  const student=(await db(`students?external_id=eq.${encodeURIComponent(studentExternalId)}&class_id=eq.${cls.id}&active=eq.true&select=id`))[0];
  if(!student)return NextResponse.json({error:"missing_student"},{status:404});

  const recordKind=allowedKinds.has(body.recordKind)?body.recordKind:undefined;
  const recordId=recordKind&&typeof body.recordId==="string"?body.recordId:undefined;
  if(recordId){
   const table=recordKind==="mood"?"daily_moods":recordKind==="capture"?"personal_treasures":"discoveries";
   const linked=(await db(`${table}?external_id=eq.${encodeURIComponent(recordId)}&student_id=eq.${student.id}&class_id=eq.${cls.id}&privacy_level=neq.self_only&select=id`))[0];
   if(!linked)return NextResponse.json({error:"private_record"},{status:403});
  }

  const payload={
   text:typeof body.text==="string"?body.text:"",
   emoji:typeof body.emoji==="string"?body.emoji:"💛",
   audio:typeof body.audio==="string"?body.audio:undefined,
   image:typeof body.image==="string"?body.image:undefined,
   drawing:typeof body.drawing==="string"?body.drawing:undefined,
   recordId,
   recordKind,
   date:typeof body.date==="string"?body.date:undefined,
   readAt:null
  };
  const row=(await db("teacher_feedback?on_conflict=external_id",{method:"POST",body:JSON.stringify({external_id:String(body.id),teacher_id:identity.teacher.id,class_id:cls.id,student_id:student.id,payload,created_at:new Date(Number(body.createdAt)||Date.now()).toISOString()})}))[0];
  return NextResponse.json({ok:true,id:row.external_id});
 }catch(error){
  console.error("teacher feedback save failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}
