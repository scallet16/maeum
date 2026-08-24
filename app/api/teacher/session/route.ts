import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,passwordOk,signTeacherSession,verifiedTeacher,verifyStudentSession} from "@/lib/supabase-admin";

const teacherCookie={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,maxAge:43200,path:"/"};

export async function POST(request:Request){
 try{
  if(verifyStudentSession((await cookies()).get("maeum_student_session")?.value||""))return NextResponse.json({error:"forbidden"},{status:403});
  const {teacherId,password}=await request.json();
  const code=String(teacherId||"").trim().toUpperCase();
  const teacher=(await db(`teachers?teacher_code=eq.${encodeURIComponent(code)}&select=id,password_hash`))[0];
  if(!teacher||!passwordOk(String(password||""),teacher.password_hash))return NextResponse.json({error:"unauthorized"},{status:401});
  const response=NextResponse.json({ok:true});
  response.cookies.set("maeum_teacher_session",signTeacherSession(teacher.id),teacherCookie);
  response.cookies.set("maeum_student_session","",{...teacherCookie,maxAge:0});
  return response;
 }catch(error){
  console.error("teacher session failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}

export async function GET(){
 if(verifyStudentSession((await cookies()).get("maeum_student_session")?.value||""))return NextResponse.json({error:"forbidden"},{status:403});
 const identity=await verifiedTeacher((await cookies()).get("maeum_teacher_session")?.value||"");
 return identity?NextResponse.json({ok:true}):NextResponse.json({error:"unauthorized"},{status:401});
}

export async function DELETE(){
 const response=NextResponse.json({ok:true});
 response.cookies.set("maeum_teacher_session","",{...teacherCookie,maxAge:0});
 return response;
}
