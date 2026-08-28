import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,verifiedTeacher} from "@/lib/supabase-admin";

const sources={
 nature:{table:"nature_cards",itemType:"nature_card",owner:"sender_student_id"},
 capture:{table:"personal_treasures",itemType:"personal_treasure",owner:"student_id"},
 discovery:{table:"discoveries",itemType:"discovery",owner:"student_id"}
} as const;

export async function POST(request:Request){
 try{
  const identity=await verifiedTeacher((await cookies()).get("maeum_teacher_session")?.value||"");
  if(!identity)return NextResponse.json({error:"forbidden"},{status:403});
  const body=await request.json(),kind=String(body.kind||"") as keyof typeof sources,id=String(body.id||""),source=sources[kind];
  if(!source||!id)return NextResponse.json({error:"invalid"},{status:400});
  const row=(await db(`${source.table}?external_id=eq.${encodeURIComponent(id)}&select=*`))[0];
  if(!row)return NextResponse.json({error:"missing"},{status:404});
  const membership=(await db(`teacher_class_memberships?teacher_id=eq.${identity.teacher.id}&class_id=eq.${row.class_id}&select=teacher_id`))[0];
  if(!membership)return NextResponse.json({error:"forbidden"},{status:403});
  const shareable=kind==="nature"?row.class_share_requested===true:row.privacy_level==="class_share";
  if(!shareable)return NextResponse.json({error:"not_shareable"},{status:403});
  await db("gallery_items?on_conflict=item_type,source_external_id",{method:"POST",body:JSON.stringify({external_id:id,class_id:row.class_id,owner_student_id:row[source.owner],item_type:source.itemType,source_external_id:id,published:true})});
  await db(`${source.table}?id=eq.${row.id}`,{method:"PATCH",body:JSON.stringify({teacher_approved:true})});
  return NextResponse.json({ok:true,id,kind});
 }catch(error){console.error("gallery approval failed",error instanceof Error?error.message:"unknown");return NextResponse.json({error:"unavailable"},{status:503})}
}
