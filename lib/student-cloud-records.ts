import "server-only";
import {db} from "@/lib/supabase-admin";
import {clientPayload} from "@/lib/private-record-media";

export async function studentCloudRecords(student:any,cls:any){
 const students=await db(`students?class_id=eq.${student.class_id}&select=id,external_id`),external=new Map(students.map((x:any)=>[x.id,x.external_id]));
 const [friends,nature,captures,discoveries,publicNature,publicTreasures,publicDiscoveries,teacherDiscoveries,publishedItems,ownReactions,reactionRows]=await Promise.all([
  db(`daily_friend_cards?class_id=eq.${student.class_id}&or=(sender_student_id.eq.${student.id},recipient_student_id.eq.${student.id})&select=*&order=created_at.desc`),
  db(`nature_cards?class_id=eq.${student.class_id}&or=(sender_student_id.eq.${student.id},recipient_student_id.eq.${student.id})&select=*&order=created_at.desc`),
  db(`personal_treasures?class_id=eq.${student.class_id}&student_id=eq.${student.id}&select=*&order=created_at.desc`),
  db(`discoveries?class_id=eq.${student.class_id}&student_id=eq.${student.id}&select=*&order=created_at.desc`),
  db(`nature_cards?class_id=eq.${student.class_id}&class_share_requested=eq.true&teacher_approved=eq.true&select=*&order=created_at.desc`),
  db(`personal_treasures?class_id=eq.${student.class_id}&privacy_level=eq.class_share&teacher_approved=eq.true&select=*&order=created_at.desc`),
  db(`discoveries?class_id=eq.${student.class_id}&privacy_level=eq.class_share&teacher_approved=eq.true&select=*&order=created_at.desc`),
  db(`teacher_discoveries?class_id=eq.${student.class_id}&published=eq.true&select=*&order=created_at.desc`),
  db(`gallery_items?class_id=eq.${student.class_id}&published=eq.true&select=item_type,source_external_id`),
  db(`gallery_reactions?class_id=eq.${student.class_id}&student_id=eq.${student.id}&reaction_type=eq.heart&select=id,gallery_item_id,created_at`),
  db(`gallery_reactions?class_id=eq.${student.class_id}&reaction_type=eq.heart&select=gallery_item_id`)
 ]);
 const published=new Set(publishedItems.map((x:any)=>`${x.item_type}:${x.source_external_id}`)),counts:Record<string,number>={};for(const row of reactionRows)counts[row.gallery_item_id]=(counts[row.gallery_item_id]||0)+1;
 return{
  friendRecords:friends.map((x:any)=>({id:x.external_id,classId:cls.external_id,from:external.get(x.sender_student_id),to:external.get(x.recipient_student_id),...clientPayload(x.payload,"friend",x.external_id),date:x.payload?.date||x.activity_date})),
  natureCards:nature.map((x:any)=>({id:x.external_id,classId:cls.external_id,from:external.get(x.sender_student_id),to:external.get(x.recipient_student_id),...clientPayload(x.payload,"nature",x.external_id),classShareRequested:x.class_share_requested,teacherApproved:x.teacher_approved,date:x.payload?.date||String(x.created_at).slice(0,10)})),
  personalEntries:[...captures.map((x:any)=>({id:x.external_id,classId:cls.external_id,ownerId:student.external_id,kind:"capture",...clientPayload(x.payload,"capture",x.external_id),privacyLevel:x.privacy_level,teacherApproved:x.teacher_approved,createdAt:new Date(x.created_at).getTime()})),...discoveries.map((x:any)=>({id:x.external_id,classId:cls.external_id,ownerId:student.external_id,kind:"discovery",...clientPayload(x.payload,"discovery",x.external_id),privacyLevel:x.privacy_level,teacherApproved:x.teacher_approved,createdAt:new Date(x.created_at).getTime()}))],
  publicGallery:{natureCards:publicNature.filter((x:any)=>published.has(`nature_card:${x.external_id}`)).map((x:any)=>({id:x.external_id,classId:cls.external_id,from:external.get(x.sender_student_id),to:external.get(x.recipient_student_id),...clientPayload(x.payload,"nature",x.external_id),classShareRequested:true,teacherApproved:true,date:x.payload?.date||String(x.created_at).slice(0,10)})),personalEntries:[...publicTreasures.filter((x:any)=>published.has(`personal_treasure:${x.external_id}`)).map((x:any)=>({id:x.external_id,classId:cls.external_id,ownerId:external.get(x.student_id),kind:"capture",...clientPayload(x.payload,"capture",x.external_id),privacyLevel:"class_share",teacherApproved:true,createdAt:new Date(x.created_at).getTime()})),...publicDiscoveries.filter((x:any)=>published.has(`discovery:${x.external_id}`)).map((x:any)=>({id:x.external_id,classId:cls.external_id,ownerId:external.get(x.student_id),kind:"discovery",...clientPayload(x.payload,"discovery",x.external_id),privacyLevel:"class_share",teacherApproved:true,createdAt:new Date(x.created_at).getTime()}))],teacherDiscoveries:teacherDiscoveries.filter((x:any)=>published.has(`teacher_discovery:${x.external_id}`)).map((x:any)=>({id:x.external_id,classId:cls.external_id,createdAt:new Date(x.created_at).getTime(),date:x.payload?.date||String(x.created_at).slice(0,10),title:x.payload?.title||"오늘의 발견",...clientPayload(x.payload,"teacher",x.external_id),published:true})),ownReactions:ownReactions.map((x:any)=>({id:x.id,classId:cls.external_id,galleryItemId:x.gallery_item_id,studentId:student.external_id,reactionType:"heart",createdAt:new Date(x.created_at).getTime()})),reactionCounts:counts}
 };
}
