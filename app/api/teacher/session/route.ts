import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,passwordHash,passwordOk,signTeacherSession,verifiedTeacher,verifyStudentSession} from "@/lib/supabase-admin";

const teacherCookie={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,maxAge:43200,path:"/"};

async function teacherBootstrap(teacher:any){
 const memberships=await db(`teacher_class_memberships?teacher_id=eq.${teacher.id}&select=class_id`);
 const classIds=memberships.map((item:any)=>item.class_id);
 if(!classIds.length)return {teacherCode:teacher.teacher_code,classes:[]};
 const classes=await db(`classes?id=in.(${classIds.join(",")})&select=id,external_id,name,class_code,feature_settings,created_at&order=created_at.asc`);
 const result=[];
 for(const cls of classes){
  const students=await db(`students?class_id=eq.${cls.id}&select=id,external_id,name,avatar,active,created_at&order=created_at.asc`);
  const studentIds=students.map((student:any)=>student.id);
  const credentials=studentIds.length?await db(`student_access_credentials?student_id=in.(${studentIds.join(",")})&select=student_id,student_code,token_version`):[];
  const externalById=new Map(students.map((student:any)=>[student.id,student.external_id]));
  result.push({id:cls.external_id,name:cls.name,classCode:cls.class_code,features:cls.feature_settings||{},students:students.map((student:any)=>({id:student.external_id,name:student.name,avatar:student.avatar,active:student.active,attendance:"present"})),credentials:credentials.map((credential:any)=>({studentId:externalById.get(credential.student_id),studentCode:credential.student_code,version:credential.token_version}))});
 }
 return {teacherCode:teacher.teacher_code,classes:result};
}

export async function POST(request:Request){
 try{
  if(verifyStudentSession((await cookies()).get("maeum_student_session")?.value||""))return NextResponse.json({error:"forbidden"},{status:403});
  const {teacherId,password}=await request.json();
  const code=String(teacherId||"").trim().toUpperCase();
  const teacher=(await db(`teachers?teacher_code=eq.${encodeURIComponent(code)}&select=id,teacher_code,password_hash`))[0];
  if(!teacher||!passwordOk(String(password||""),teacher.password_hash))return NextResponse.json({error:"unauthorized"},{status:401});
  const response=NextResponse.json({ok:true,...await teacherBootstrap(teacher)});
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

export async function PATCH(request:Request){
 try{
  const jar=await cookies();
  if(verifyStudentSession(jar.get("maeum_student_session")?.value||""))return NextResponse.json({error:"forbidden"},{status:403});
  const identity=await verifiedTeacher(jar.get("maeum_teacher_session")?.value||"");
  if(!identity)return NextResponse.json({error:"unauthorized"},{status:401});
  const {currentPassword,newPassword}=await request.json();
  if(String(newPassword||"").length<4)return NextResponse.json({error:"invalid_password"},{status:400});
  const teacher=(await db(`teachers?id=eq.${identity.teacher.id}&select=id,password_hash`))[0];
  if(!teacher||!passwordOk(String(currentPassword||""),teacher.password_hash))return NextResponse.json({error:"unauthorized"},{status:401});
  await db(`teachers?id=eq.${teacher.id}`,{method:"PATCH",body:JSON.stringify({password_hash:passwordHash(String(newPassword))})});
  return NextResponse.json({ok:true});
 }catch(error){
  console.error("teacher password change failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}

export async function DELETE(){
 const response=NextResponse.json({ok:true});
 response.cookies.set("maeum_teacher_session","",{...teacherCookie,maxAge:0});
 return response;
}