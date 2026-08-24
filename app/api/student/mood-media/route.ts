import {randomUUID} from "node:crypto";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {db,verifiedStudent} from "@/lib/supabase-admin";
import {deletePrivateObject,uploadPrivateObject} from "@/lib/supabase-storage";

const mediaTypes=["audio","image","drawing"] as const;
const extensions:Record<string,string>={"audio/webm":"webm","audio/mp4":"m4a","audio/ogg":"ogg","audio/mpeg":"mp3","image/png":"png","image/jpeg":"jpg","image/webp":"webp"};

function decodeDataUrl(value:unknown){
 if(typeof value!=="string"||!value.startsWith("data:"))return null;
 const match=value.match(/^data:([^;,]+);base64,([\s\S]+)$/);
 if(!match)return null;
 const bytes=Uint8Array.from(Buffer.from(match[2],"base64"));
 if(!bytes.length||bytes.length>10*1024*1024)return null;
 return{mimeType:match[1].toLowerCase(),bytes};
}

export async function POST(request:Request){
 try{
  const identity=await verifiedStudent((await cookies()).get("maeum_student_session")?.value||"");
  if(!identity)return NextResponse.json({error:"unauthorized"},{status:401});
  const body=await request.json();
  const mood=(await db(`daily_moods?external_id=eq.${encodeURIComponent(String(body.id||""))}&student_id=eq.${identity.student.id}&class_id=eq.${identity.student.class_id}&select=id,external_id`))[0];
  if(!mood)return NextResponse.json({error:"forbidden"},{status:403});
  const failed:string[]=[];
  const media:Record<string,string>={};
  for(const mediaType of mediaTypes){
   const decoded=decodeDataUrl(body[mediaType]);
   if(!decoded)continue;
   const extension=extensions[decoded.mimeType];
   if(!extension||(mediaType==="audio"?!decoded.mimeType.startsWith("audio/"):!decoded.mimeType.startsWith("image/"))){failed.push(mediaType);continue}
   const prior=(await db(`mood_media?mood_id=eq.${mood.id}&media_type=eq.${mediaType}&select=id,storage_path`))[0];
   const mediaId=prior?.id||randomUUID();
   const path=`classes/${identity.student.class_id}/students/${identity.student.id}/moods/${mood.id}/${mediaType}/${mediaId}.${extension}`;
   try{
    await uploadPrivateObject("student-media",path,decoded.bytes,decoded.mimeType);
    await db("mood_media?on_conflict=mood_id,media_type",{method:"POST",body:JSON.stringify({id:mediaId,mood_id:mood.id,student_id:identity.student.id,class_id:identity.student.class_id,media_type:mediaType,storage_path:path,mime_type:decoded.mimeType,duration_ms:mediaType==="audio"&&Number.isFinite(body.audioDurationMs)?Math.max(0,Math.round(body.audioDurationMs)):null})});
    if(prior?.storage_path&&prior.storage_path!==path)await deletePrivateObject("student-media",prior.storage_path).catch(()=>undefined);
    media[mediaType]=`/api/media/moods/${encodeURIComponent(mood.external_id)}/${mediaType}`;
   }catch(error){
    await deletePrivateObject("student-media",path).catch(()=>undefined);
    failed.push(mediaType);
    console.error("student mood media upload failed",mediaType,error instanceof Error?error.message:"unknown");
   }
  }
  return NextResponse.json({ok:true,media,mediaFailed:failed});
 }catch(error){
  console.error("student mood media sync failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"unavailable"},{status:503});
 }
}
