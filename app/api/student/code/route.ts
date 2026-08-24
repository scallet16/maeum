import {NextResponse} from "next/server";
import {db,passwordOk,signStudentSession} from "@/lib/supabase-admin";

export async function POST(request:Request){
 try{
  const body=await request.json();
  const studentCode=String(body.studentCode||"").trim().toUpperCase();
  const pin=String(body.pin||"");
  if(!/^[A-Z0-9]{6,16}$/.test(studentCode)||!/^[0-9]{4,6}$/.test(pin))return NextResponse.json({error:"invalid"},{status:404});
  const credential=(await db(`student_access_credentials?student_code=eq.${encodeURIComponent(studentCode)}&select=student_id,pin_hash,token_version`))[0];
  if(!credential||!passwordOk(pin,credential.pin_hash))return NextResponse.json({error:"invalid"},{status:404});
  const student=(await db(`students?id=eq.${credential.student_id}&active=eq.true&select=id,class_id,external_id,name,avatar,active`))[0];
  if(!student)return NextResponse.json({error:"invalid"},{status:404});
  const cls=(await db(`classes?id=eq.${student.class_id}&select=id,external_id,name,feature_settings`))[0];
  if(!cls)return NextResponse.json({error:"invalid"},{status:404});
  const students=await db(`students?class_id=eq.${student.class_id}&active=eq.true&select=external_id,name,avatar,active`);
  const moods=await db(`daily_moods?student_id=eq.${student.id}&class_id=eq.${student.class_id}&select=external_id,emoji_a,emoji_b,note,activity_date,created_at,privacy_level`);
  const response=NextResponse.json({
   student:{id:student.external_id,name:student.name,avatar:student.avatar,active:student.active},
   classData:{id:cls.external_id,name:cls.name,features:cls.feature_settings,students:students.map((item:any)=>({id:item.external_id,name:item.name,avatar:item.avatar,active:item.active,attendance:"present"}))},
   moods:moods.map((mood:any)=>({id:mood.external_id,classId:cls.external_id,ownerId:student.external_id,a:mood.emoji_a,b:mood.emoji_b,note:mood.note,date:mood.activity_date,createdAt:new Date(mood.created_at).getTime(),privacyLevel:mood.privacy_level}))
  });
  response.cookies.set("maeum_student_session",signStudentSession(student.id,cls.id,credential.token_version),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:43200,path:"/"});
  return response;
 }catch(error){
  console.error("student code resolve failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}
