import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,verifiedStudent,verifiedTeacher} from "@/lib/supabase-admin";
import {signedPrivateObjectUrl} from "@/lib/supabase-storage";

const mediaTypes=new Set(["audio","image","drawing"]);

export async function GET(_:Request,{params}:{params:Promise<{moodId:string;mediaType:string}>}){
 try{
  const {moodId,mediaType}=await params;
  if(!mediaTypes.has(mediaType))return NextResponse.json({error:"missing"},{status:404});
  const jar=await cookies();
  const student=await verifiedStudent(jar.get("maeum_student_session")?.value||"");
  const teacher=student?null:await verifiedTeacher(jar.get("maeum_teacher_session")?.value||"");
  const mood=(await db(`daily_moods?external_id=eq.${encodeURIComponent(moodId)}&select=id,student_id,class_id,privacy_level`))[0];
  if(!mood)return NextResponse.json({error:"missing"},{status:404});
  if(student){
   if(student.student.id!==mood.student_id||student.student.class_id!==mood.class_id)return NextResponse.json({error:"forbidden"},{status:403});
  }else if(teacher){
   if(mood.privacy_level==="self_only")return NextResponse.json({error:"forbidden"},{status:403});
   const membership=(await db(`teacher_class_memberships?teacher_id=eq.${teacher.teacher.id}&class_id=eq.${mood.class_id}&select=teacher_id`))[0];
   if(!membership)return NextResponse.json({error:"forbidden"},{status:403});
  }else return NextResponse.json({error:"unauthorized"},{status:401});
  const media=(await db(`mood_media?mood_id=eq.${mood.id}&media_type=eq.${mediaType}&select=storage_path`))[0];
  if(!media)return NextResponse.json({error:"missing"},{status:404});
  return NextResponse.redirect(await signedPrivateObjectUrl("student-media",media.storage_path,60),303);
 }catch(error){
  console.error("private mood media failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}
