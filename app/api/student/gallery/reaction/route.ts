import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,verifiedStudent} from "@/lib/supabase-admin";

export async function POST(request:Request){
 try{
  const identity=await verifiedStudent((await cookies()).get("maeum_student_session")?.value||"");
  if(!identity)return NextResponse.json({error:"unauthorized"},{status:401});
  const {galleryItemId}=await request.json(),id=String(galleryItemId||"");
  if(!id)return NextResponse.json({error:"invalid"},{status:400});
  const item=(await db(`gallery_items?external_id=eq.${encodeURIComponent(id)}&class_id=eq.${identity.student.class_id}&published=eq.true&select=external_id,owner_student_id`))[0];
  if(!item)return NextResponse.json({error:"missing"},{status:404});
  if(item.owner_student_id===identity.student.id)return NextResponse.json({error:"own_work"},{status:403});
  const query=`gallery_reactions?class_id=eq.${identity.student.class_id}&gallery_item_id=eq.${encodeURIComponent(id)}&student_id=eq.${identity.student.id}&reaction_type=eq.heart`;
  const existing=(await db(`${query}&select=id`))[0];
  if(existing){await db(query,{method:"DELETE"});return NextResponse.json({active:false,galleryItemId:id})}
  const inserted=(await db("gallery_reactions?on_conflict=student_id,gallery_item_id,reaction_type",{method:"POST",body:JSON.stringify({class_id:identity.student.class_id,gallery_item_id:id,student_id:identity.student.id,reaction_type:"heart"})}))[0];
  return NextResponse.json({active:true,galleryItemId:id,reaction:{id:inserted.id,classId:"",galleryItemId:id,studentId:identity.student.external_id,reactionType:"heart",createdAt:new Date(inserted.created_at||Date.now()).getTime()}});
 }catch(error){console.error("gallery reaction failed",error instanceof Error?error.message:"unknown");return NextResponse.json({error:"unavailable"},{status:503})}
}
