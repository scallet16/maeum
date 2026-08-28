import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {clientPayload} from "@/lib/private-record-media";
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
  const selfMoods=await db(`daily_moods?class_id=eq.${cls.id}&privacy_level=eq.self_only&select=external_id,student_id,activity_date,created_at,privacy_level`);
  const media=moods.length?await db(`mood_media?mood_id=in.(${moods.map((mood:any)=>mood.id).join(",")})&select=mood_id,media_type`):[];
  const mediaByMood=new Map<string,Set<string>>();
  for(const item of media){const set=mediaByMood.get(item.mood_id)||new Set<string>();set.add(item.media_type);mediaByMood.set(item.mood_id,set)}
  const [friendCards,natureCards,captures,discoveries]=await Promise.all([
   db(`daily_friend_cards?class_id=eq.${cls.id}&select=*`),
   db(`nature_cards?class_id=eq.${cls.id}&select=*`),
   db(`personal_treasures?class_id=eq.${cls.id}&privacy_level=in.(class_share,teacher_private)&select=*`),
   db(`discoveries?class_id=eq.${cls.id}&privacy_level=in.(class_share,teacher_private)&select=*`)
  ]);
  const [feedback,galleryReactions,teacherDiscoveries]=await Promise.all([db(`teacher_feedback?class_id=eq.${cls.id}&teacher_id=eq.${identity.teacher.id}&select=external_id,student_id,payload,created_at&order=created_at.desc`),db(`gallery_reactions?class_id=eq.${cls.id}&reaction_type=eq.heart&select=id,gallery_item_id,student_id,created_at`),db(`teacher_discoveries?class_id=eq.${cls.id}&published=eq.true&select=*&order=created_at.desc`)]);
  return NextResponse.json({
   moods:[...moods.map((mood:any)=>({id:mood.external_id,classId,ownerId:externalById.get(mood.student_id),a:mood.emoji_a,b:mood.emoji_b,note:mood.note,date:mood.activity_date,createdAt:new Date(mood.created_at).getTime(),privacyLevel:mood.privacy_level,...Object.fromEntries([...mediaByMood.get(mood.id)||[]].map(type=>[type,`/api/media/moods/${encodeURIComponent(mood.external_id)}/${type}`]))})),...selfMoods.map((mood:any)=>({id:mood.external_id,classId,ownerId:externalById.get(mood.student_id),a:"",b:"",note:"",date:mood.activity_date,createdAt:new Date(mood.created_at).getTime(),privacyLevel:"self_only"}))],
   friendRecords:friendCards.map((x:any)=>({id:x.external_id,classId,from:externalById.get(x.sender_student_id),to:externalById.get(x.recipient_student_id),...clientPayload(x.payload,"friend",x.external_id),date:x.payload?.date||x.activity_date})),
   natureCards:natureCards.map((x:any)=>({id:x.external_id,classId,from:externalById.get(x.sender_student_id),to:externalById.get(x.recipient_student_id),...clientPayload(x.payload,"nature",x.external_id),classShareRequested:x.class_share_requested,teacherApproved:x.teacher_approved,date:x.payload?.date||String(x.created_at).slice(0,10)})),
   personalEntries:[...captures.map((x:any)=>({id:x.external_id,classId,ownerId:externalById.get(x.student_id),kind:"capture",...clientPayload(x.payload,"capture",x.external_id),privacyLevel:x.privacy_level,teacherApproved:x.teacher_approved,createdAt:new Date(x.created_at).getTime()})),...discoveries.map((x:any)=>({id:x.external_id,classId,ownerId:externalById.get(x.student_id),kind:"discovery",...clientPayload(x.payload,"discovery",x.external_id),privacyLevel:x.privacy_level,teacherApproved:x.teacher_approved,createdAt:new Date(x.created_at).getTime()}))],
   teacherDiscoveries:teacherDiscoveries.map((row:any)=>({id:row.external_id,classId,createdAt:new Date(row.created_at).getTime(),date:row.payload?.date||String(row.created_at).slice(0,10),title:row.payload?.title||"오늘의 발견",...clientPayload(row.payload,"teacher",row.external_id),published:true})),
   galleryReactions:galleryReactions.map((row:any)=>({id:row.id,classId,studentId:externalById.get(row.student_id),galleryItemId:row.gallery_item_id,reactionType:"heart",createdAt:new Date(row.created_at).getTime()})),
   letters:feedback.map((row:any)=>({id:row.external_id,classId,studentId:externalById.get(row.student_id),createdAt:new Date(row.created_at).getTime(),date:row.payload?.date||new Date(row.created_at).toLocaleDateString("ko-KR"),text:row.payload?.text||"",emoji:row.payload?.emoji||"💛",audio:row.payload?.audio,image:row.payload?.image,drawing:row.payload?.drawing,recordId:row.payload?.recordId,recordKind:row.payload?.recordKind,readAt:row.payload?.readAt?Number(row.payload.readAt):undefined}))
  });
 }catch(error){
  console.error("teacher cloud pull failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}
