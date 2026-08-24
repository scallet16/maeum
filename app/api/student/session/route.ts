import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {studentCloudRecords} from "@/lib/student-cloud-records";
import {db,verifiedStudent} from "@/lib/supabase-admin";

export async function GET(){
 try{
  const identity=await verifiedStudent((await cookies()).get("maeum_student_session")?.value||"");
  if(!identity)return NextResponse.json({error:"unauthorized"},{status:401});
  const student=identity.student;
  const cls=(await db(`classes?id=eq.${student.class_id}&select=id,external_id,name,feature_settings`))[0];
  if(!cls)return NextResponse.json({error:"unauthorized"},{status:401});
  const [students,moods,records]=await Promise.all([
   db(`students?class_id=eq.${student.class_id}&active=eq.true&select=external_id,name,avatar,active&order=created_at.asc`),
   db(`daily_moods?student_id=eq.${student.id}&class_id=eq.${student.class_id}&select=id,external_id,emoji_a,emoji_b,note,activity_date,created_at,privacy_level`),
   studentCloudRecords(student,cls)
  ]);
  const media=moods.length?await db(`mood_media?mood_id=in.(${moods.map((mood:any)=>mood.id).join(",")})&select=mood_id,media_type`):[];
  const mediaByMood=new Map<string,Set<string>>();
  for(const item of media){const set=mediaByMood.get(item.mood_id)||new Set<string>();set.add(item.media_type);mediaByMood.set(item.mood_id,set)}
  return NextResponse.json({
   student:{id:student.external_id,name:student.name,avatar:student.avatar,active:student.active},
   classData:{id:cls.external_id,name:cls.name,features:cls.feature_settings,students:students.map((item:any)=>({id:item.external_id,name:item.name,avatar:item.avatar,active:item.active,attendance:"present"}))},
   ...records,
   moods:moods.map((mood:any)=>({id:mood.external_id,classId:cls.external_id,ownerId:student.external_id,a:mood.emoji_a,b:mood.emoji_b,note:mood.note,date:mood.activity_date,createdAt:new Date(mood.created_at).getTime(),privacyLevel:mood.privacy_level,...Object.fromEntries([...mediaByMood.get(mood.id)||[]].map(type=>[type,`/api/media/moods/${encodeURIComponent(mood.external_id)}/${type}`]))}))
  });
 }catch(error){
  console.error("student session restore failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}
export async function DELETE(){
 const response=NextResponse.json({ok:true});
 response.cookies.set("maeum_student_session","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:0,path:"/"});
 return response;
}
