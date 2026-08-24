import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,verifiedStudent} from "@/lib/supabase-admin";

export async function GET(){
 try{
  const identity=await verifiedStudent((await cookies()).get("maeum_student_session")?.value||"");
  if(!identity)return NextResponse.json({error:"forbidden"},{status:403});
  const rows=await db(`teacher_feedback?student_id=eq.${identity.student.id}&class_id=eq.${identity.student.class_id}&select=external_id,payload,created_at&order=created_at.desc`);
  return NextResponse.json({letters:rows.map((row:any)=>({id:row.external_id,classId:identity.student.class_id,studentId:identity.student.external_id,createdAt:new Date(row.created_at).getTime(),date:row.payload?.date||new Date(row.created_at).toLocaleDateString("ko-KR"),text:row.payload?.text||"",emoji:row.payload?.emoji||"💛",audio:row.payload?.audio,image:row.payload?.image,drawing:row.payload?.drawing,recordId:row.payload?.recordId,recordKind:row.payload?.recordKind,readAt:row.payload?.readAt?Number(row.payload.readAt):undefined}))});
 }catch(error){
  console.error("student feedback read failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}

export async function PATCH(request:Request){
 try{
  const identity=await verifiedStudent((await cookies()).get("maeum_student_session")?.value||"");
  if(!identity)return NextResponse.json({error:"forbidden"},{status:403});
  const {id}=await request.json();
  const row=(await db(`teacher_feedback?external_id=eq.${encodeURIComponent(String(id||""))}&student_id=eq.${identity.student.id}&class_id=eq.${identity.student.class_id}&select=id,payload`))[0];
  if(!row)return NextResponse.json({error:"missing"},{status:404});
  await db(`teacher_feedback?id=eq.${row.id}`,{method:"PATCH",body:JSON.stringify({payload:{...row.payload,readAt:Date.now()}})});
  return NextResponse.json({ok:true});
 }catch(error){
  console.error("student feedback update failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}
