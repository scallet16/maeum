import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,verifiedStudent,verifiedTeacher} from "@/lib/supabase-admin";
import {signedPrivateObjectUrl} from "@/lib/supabase-storage";

export async function GET(_:Request,{params}:{params:Promise<{kind:string;recordId:string;field:string}>}){
 try{
  const {kind,recordId,field}=await params;if(!["image","drawing","audio"].includes(field))return NextResponse.json({error:"missing"},{status:404});
  const config:any={friend:["daily_friend_cards",null],nature:["nature_cards",null],capture:["personal_treasures","privacy_level"],discovery:["discoveries","privacy_level"],teacher:["teacher_discoveries",null]},entry=config[kind];if(!entry)return NextResponse.json({error:"missing"},{status:404});
  const row=(await db(`${entry[0]}?external_id=eq.${encodeURIComponent(recordId)}&select=*`))[0];if(!row)return NextResponse.json({error:"missing"},{status:404});
  const jar=await cookies(),student=await verifiedStudent(jar.get("maeum_student_session")?.value||""),teacher=student?null:await verifiedTeacher(jar.get("maeum_teacher_session")?.value||"");
  if(student){let allowed=kind==="friend"?row.recipient_student_id===student.student.id||row.sender_student_id===student.student.id:kind==="nature"?row.recipient_student_id===student.student.id||row.sender_student_id===student.student.id:row.student_id===student.student.id;if(!allowed&&row.class_id===student.student.class_id&&kind!=="friend"){const shareable=kind==="nature"?row.class_share_requested===true&&row.teacher_approved===true:kind==="teacher"?row.published===true:row.privacy_level==="class_share"&&row.teacher_approved===true;if(shareable)allowed=!!(await db(`gallery_items?class_id=eq.${row.class_id}&source_external_id=eq.${encodeURIComponent(recordId)}&published=eq.true&select=id`))[0]}if(!allowed||row.class_id!==student.student.class_id)return NextResponse.json({error:"forbidden"},{status:403})}
  else if(teacher){if(row.privacy_level==="self_only")return NextResponse.json({error:"forbidden"},{status:403});const member=(await db(`teacher_class_memberships?teacher_id=eq.${teacher.teacher.id}&class_id=eq.${row.class_id}&select=teacher_id`))[0];if(!member)return NextResponse.json({error:"forbidden"},{status:403})}
  else return NextResponse.json({error:"unauthorized"},{status:401});
  const path=row.payload?.[`${field}Path`];if(!path)return NextResponse.json({error:"missing"},{status:404});return NextResponse.redirect(await signedPrivateObjectUrl("student-media",path,60),303);
 }catch(error){console.error("record media failed",error instanceof Error?error.message:"unknown");return NextResponse.json({error:"unavailable"},{status:503})}
}
