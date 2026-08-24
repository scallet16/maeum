import "server-only";
import {db} from "@/lib/supabase-admin";
import {clientPayload} from "@/lib/private-record-media";

export async function studentCloudRecords(student:any,cls:any){
 const students=await db(`students?class_id=eq.${student.class_id}&select=id,external_id`),external=new Map(students.map((x:any)=>[x.id,x.external_id]));
 const [friends,nature,captures,discoveries]=await Promise.all([
  db(`daily_friend_cards?class_id=eq.${student.class_id}&or=(sender_student_id.eq.${student.id},recipient_student_id.eq.${student.id})&select=*&order=created_at.desc`),
  db(`nature_cards?class_id=eq.${student.class_id}&or=(sender_student_id.eq.${student.id},recipient_student_id.eq.${student.id})&select=*&order=created_at.desc`),
  db(`personal_treasures?class_id=eq.${student.class_id}&student_id=eq.${student.id}&select=*&order=created_at.desc`),
  db(`discoveries?class_id=eq.${student.class_id}&student_id=eq.${student.id}&select=*&order=created_at.desc`)
 ]);
 return{
  friendRecords:friends.map((x:any)=>({id:x.external_id,classId:cls.external_id,from:external.get(x.sender_student_id),to:external.get(x.recipient_student_id),...clientPayload(x.payload,"friend",x.external_id),date:x.payload?.date||x.activity_date})),
  natureCards:nature.map((x:any)=>({id:x.external_id,classId:cls.external_id,from:external.get(x.sender_student_id),to:external.get(x.recipient_student_id),...clientPayload(x.payload,"nature",x.external_id),classShareRequested:x.class_share_requested,teacherApproved:x.teacher_approved,date:x.payload?.date||String(x.created_at).slice(0,10)})),
  personalEntries:[...captures.map((x:any)=>({id:x.external_id,classId:cls.external_id,ownerId:student.external_id,kind:"capture",...clientPayload(x.payload,"capture",x.external_id),privacyLevel:x.privacy_level,teacherApproved:x.teacher_approved,createdAt:new Date(x.created_at).getTime()})),...discoveries.map((x:any)=>({id:x.external_id,classId:cls.external_id,ownerId:student.external_id,kind:"discovery",...clientPayload(x.payload,"discovery",x.external_id),privacyLevel:x.privacy_level,teacherApproved:x.teacher_approved,createdAt:new Date(x.created_at).getTime()}))]
 };
}
