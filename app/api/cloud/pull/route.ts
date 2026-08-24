import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,verifiedTeacher,verifyStudentSession} from "@/lib/supabase-admin";

export async function POST(request:Request){
 try{
  if(verifyStudentSession((await cookies()).get("maeum_student_session")?.value||""))return NextResponse.json({error:"forbidden"},{status:403});
  const identity=await verifiedTeacher((await cookies()).get("maeum_teacher_session")?.value||"");
  if(!identity)return NextResponse.json({error:"forbidden"},{status:403});
  const {classId}=await request.json();
  const cls=(await db(`classes?external_id=eq.${encodeURIComponent(String(classId||""))}&select=id`))[0];
  if(!cls)return NextResponse.json({error:"missing"},{status:404});
  const membership=(await db(`teacher_class_memberships?teacher_id=eq.${identity.teacher.id}&class_id=eq.${cls.id}&select=teacher_id`))[0];
  if(!membership)return NextResponse.json({error:"forbidden"},{status:403});
  const students=await db(`students?class_id=eq.${cls.id}&select=id,external_id`);
  const externalById=new Map(students.map((student:any)=>[student.id,student.external_id]));
  const moods=await db(`daily_moods?class_id=eq.${cls.id}&privacy_level=in.(class_share,teacher_private)&select=*`);
  const media=moods.length?await db(`mood_media?mood_id=in.(${moods.map((mood:any)=>mood.id).join(",")})&select=mood_id,media_type`):[];
  const mediaByMood=new Map<string,Set<string>>();
  for(const item of media){const set=mediaByMood.get(item.mood_id)||new Set<string>();set.add(item.media_type);mediaByMood.set(item.mood_id,set)}
  const feedback=await db(`teacher_feedback?class_id=eq.${cls.id}&teacher_id=eq.${identity.teacher.id}&select=external_id,student_id,payload,created_at&order=created_at.desc`);
  return NextResponse.json({
   moods:moods.map((mood:any)=>({id:mood.external_id,classId,ownerId:externalById.get(mood.student_id),a:mood.emoji_a,b:mood.emoji_b,note:mood.note,date:mood.activity_date,createdAt:new Date(mood.created_at).getTime(),privacyLevel:mood.privacy_level,...Object.fromEntries([...mediaByMood.get(mood.id)||[]].map(type=>[type,`/api/media/moods/${encodeURIComponent(mood.external_id)}/${type}`]))})),
   letters:feedback.map((row:any)=>({id:row.external_id,classId,studentId:externalById.get(row.student_id),createdAt:new Date(row.created_at).getTime(),date:row.payload?.date||new Date(row.created_at).toLocaleDateString("ko-KR"),text:row.payload?.text||"",emoji:row.payload?.emoji||"💛",audio:row.payload?.audio,image:row.payload?.image,drawing:row.payload?.drawing,recordId:row.payload?.recordId,recordKind:row.payload?.recordKind,readAt:row.payload?.readAt?Number(row.payload.readAt):undefined}))
  });
 }catch(error){
  console.error("teacher cloud pull failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}
