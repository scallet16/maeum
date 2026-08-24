import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,verifiedStudent} from "@/lib/supabase-admin";

const privacyLevels=new Set(["class_share","teacher_private","self_only"]);

export async function POST(request:Request){
 try{
  const identity=await verifiedStudent((await cookies()).get("maeum_student_session")?.value||"");
  if(!identity)return NextResponse.json({error:"unauthorized"},{status:401});
  const mood=await request.json();
  if(typeof mood.id!=="string"||!privacyLevels.has(mood.privacyLevel)||typeof mood.a!=="string"||typeof mood.b!=="string")return NextResponse.json({error:"invalid_request"},{status:400});
  const existing=(await db(`daily_moods?external_id=eq.${encodeURIComponent(mood.id)}&select=student_id,class_id`))[0];
  if(existing&&(existing.student_id!==identity.student.id||existing.class_id!==identity.student.class_id))return NextResponse.json({error:"forbidden"},{status:403});
  await db("daily_moods?on_conflict=external_id",{method:"POST",body:JSON.stringify({
   external_id:mood.id,
   class_id:identity.student.class_id,
   student_id:identity.student.id,
   emoji_a:mood.a,
   emoji_b:mood.b,
   note:typeof mood.note==="string"?mood.note:"",
   privacy_level:mood.privacyLevel,
   activity_date:new Date(mood.createdAt).toISOString().slice(0,10),
   created_at:new Date(mood.createdAt).toISOString()
  })});
  return NextResponse.json({ok:true});
 }catch(error){
  console.error("student mood sync failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}
