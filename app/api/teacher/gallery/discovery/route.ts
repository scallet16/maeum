import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {compactPrivateMedia,clientPayload} from "@/lib/private-record-media";
import {db,verifiedTeacher} from "@/lib/supabase-admin";

export async function POST(request:Request){
 try{
  const identity=await verifiedTeacher((await cookies()).get("maeum_teacher_session")?.value||"");
  if(!identity)return NextResponse.json({error:"forbidden"},{status:403});
  const record=await request.json(),classId=String(record.classId||""),externalId=String(record.id||"");
  if(!classId||!externalId)return NextResponse.json({error:"invalid"},{status:400});
  const cls=(await db(`classes?external_id=eq.${encodeURIComponent(classId)}&select=id,external_id`))[0];
  if(!cls)return NextResponse.json({error:"missing"},{status:404});
  const membership=(await db(`teacher_class_memberships?teacher_id=eq.${identity.teacher.id}&class_id=eq.${cls.id}&select=teacher_id`))[0];
  if(!membership)return NextResponse.json({error:"forbidden"},{status:403});
  const payload=await compactPrivateMedia({...record,id:undefined,classId:undefined,published:undefined,createdAt:undefined},`classes/${cls.id}/teachers/${identity.teacher.id}/discovery/${crypto.randomUUID()}`);
  await db("teacher_discoveries?on_conflict=external_id",{method:"POST",body:JSON.stringify({external_id:externalId,teacher_id:identity.teacher.id,class_id:cls.id,payload,published:true,created_at:new Date(record.createdAt||Date.now()).toISOString()})});
  await db("gallery_items?on_conflict=item_type,source_external_id",{method:"POST",body:JSON.stringify({external_id:externalId,class_id:cls.id,owner_student_id:null,item_type:"teacher_discovery",source_external_id:externalId,published:true})});
  return NextResponse.json({record:{...record,...clientPayload(payload,"teacher",externalId),published:true}});
 }catch(error){console.error("teacher discovery save failed",error instanceof Error?error.message:"unknown");return NextResponse.json({error:"unavailable"},{status:503})}
}
