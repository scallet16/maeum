import "server-only";
import {randomUUID} from "node:crypto";
import {uploadPrivateObject} from "@/lib/supabase-storage";

const extensions:Record<string,string>={"audio/webm":"webm","audio/mp4":"m4a","audio/ogg":"ogg","audio/mpeg":"mp3","image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/svg+xml":"svg"};

export async function compactPrivateMedia(input:Record<string,any>,basePath:string){
 const payload={...input};
 for(const field of ["image","drawing","audio"]){
  const value=input[field];
  if(typeof value!=="string"||!value.startsWith("data:"))continue;
  const match=value.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if(!match)continue;
  const mime=match[1].toLowerCase(),extension=extensions[mime],bytes=Uint8Array.from(Buffer.from(match[2],"base64"));
  if(!extension||!bytes.length||bytes.length>10*1024*1024)throw new Error(`invalid_${field}`);
  const path=`${basePath}/${field}/${randomUUID()}.${extension}`;
  await uploadPrivateObject("student-media",path,bytes,mime);
  payload[`${field}Path`]=path;
  delete payload[field];
 }
 return payload;
}

export function clientPayload(payload:any,kind:string,id:string){
 const result={...payload};
 for(const field of ["image","drawing","audio"])if(payload?.[`${field}Path`])result[field]=`/api/media/records/${kind}/${encodeURIComponent(id)}/${field}`;
 delete result.imagePath;delete result.drawingPath;delete result.audioPath;
 return result;
}
