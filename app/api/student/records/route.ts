import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,verifiedStudent} from "@/lib/supabase-admin";
import {clientPayload,compactPrivateMedia} from "@/lib/private-record-media";

export async function POST(request:Request){
 try{
  const identity=await verifiedStudent((await cookies()).get("maeum_student_session")?.value||"");
  if(!identity)return NextResponse.json({error:"unauthorized"},{status:401});
  const body=await request.json(),kind=String(body.kind||""),record=body.record||{},classId=identity.student.class_id,studentId=identity.student.id;
  const externalId=String(record.id||"");if(!externalId)return NextResponse.json({error:"invalid"},{status:400});
  const base=`classes/${classId}/students/${studentId}/${kind}/${crypto.randomUUID()}`;
  if(kind==="friend"){
   const recipient=(await db(`students?external_id=eq.${encodeURIComponent(String(record.to||""))}&class_id=eq.${classId}&active=eq.true&select=id`))[0];
   if(!recipient||recipient.id===studentId)return NextResponse.json({error:"recipient"},{status:403});
   const classmates=await db(`students?class_id=eq.${classId}&active=eq.true&select=id&order=created_at.asc`),index=classmates.findIndex((x:any)=>x.id===studentId),expected=classmates[(index+1)%classmates.length]?.id;
   if(expected!==recipient.id)return NextResponse.json({error:"pairing"},{status:403});
   const payload=await compactPrivateMedia({text:record.text||"",emoji:record.emoji||"",date:record.date,drawing:record.drawing,audio:record.audio,image:record.image,backgroundColor:record.backgroundColor},base);
   await db("daily_friend_cards?on_conflict=external_id",{method:"POST",body:JSON.stringify({external_id:externalId,class_id:classId,sender_student_id:studentId,recipient_student_id:recipient.id,payload,activity_date:new Date().toISOString().slice(0,10)})});
   return NextResponse.json({record:{...record,...clientPayload(payload,"friend",externalId)}});
  }
  if(kind==="nature"){
   const recipient=(await db(`students?external_id=eq.${encodeURIComponent(String(record.to||""))}&class_id=eq.${classId}&active=eq.true&select=id`))[0];
   if(!recipient||recipient.id===studentId)return NextResponse.json({error:"recipient"},{status:403});
   const payload=await compactPrivateMedia({...record,from:undefined,to:undefined,id:undefined},base);
   await db("nature_cards?on_conflict=external_id",{method:"POST",body:JSON.stringify({external_id:externalId,class_id:classId,sender_student_id:studentId,recipient_student_id:recipient.id,payload,class_share_requested:!!record.classShareRequested,teacher_approved:false})});
   const active=await db(`students?class_id=eq.${classId}&active=eq.true&select=id`),cards=await db(`nature_cards?class_id=eq.${classId}&select=id,recipient_student_id,payload`);
   if(active.length>1&&active.every((s:any)=>cards.some((c:any)=>c.recipient_student_id===s.id&&!c.payload?.releasedBatch))){const batch=Math.max(0,...cards.map((c:any)=>Number(c.payload?.releasedBatch)||0))+1;for(const s of active){for(const card of cards.filter((c:any)=>c.recipient_student_id===s.id&&!c.payload?.releasedBatch).slice(0,2))await db(`nature_cards?id=eq.${card.id}`,{method:"PATCH",body:JSON.stringify({payload:{...card.payload,releasedBatch:batch}})})}}
   return NextResponse.json({record:{...record,...clientPayload(payload,"nature",externalId)}});
  }
  if(kind==="capture"||kind==="discovery"){
   const table=kind==="capture"?"personal_treasures":"discoveries",payload=await compactPrivateMedia({...record,id:undefined,classId:undefined,ownerId:undefined,privacyLevel:undefined,teacherApproved:undefined},base);
   await db(`${table}?on_conflict=external_id`,{method:"POST",body:JSON.stringify({external_id:externalId,class_id:classId,student_id:studentId,payload,privacy_level:record.privacyLevel,teacher_approved:false,created_at:new Date(record.createdAt||Date.now()).toISOString()})});
   return NextResponse.json({record:{...record,...clientPayload(payload,kind,externalId)}});
  }
  return NextResponse.json({error:"invalid"},{status:400});
 }catch(error){console.error("student record save failed",error instanceof Error?error.message:"unknown");return NextResponse.json({error:"unavailable"},{status:503})}
}
