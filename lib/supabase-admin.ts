import "server-only";

import {createHash,createHmac,randomBytes,scryptSync,timingSafeEqual} from "node:crypto";

const url=()=>{
 const value=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!value)throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
 return value.replace(/\/$/,"");
};

function serverKey(){
 const secret=process.env.SUPABASE_SECRET_KEY;
 if(secret)return {value:secret,legacy:false};
 const legacy=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(legacy)return {value:legacy,legacy:true};
 throw new Error("SUPABASE_SECRET_KEY is missing");
}

export class SupabaseRequestError extends Error{
 constructor(public table:string,public status:number,public code:string,message:string){
  super(message);
  this.name="SupabaseRequestError";
 }
}
export async function db(path:string,init:RequestInit={}){
 const key=serverKey();
 const headers:Record<string,string>={
  apikey:key.value,
  "Content-Type":"application/json",
  Prefer:"return=representation,resolution=merge-duplicates",
  ...Object.fromEntries(new Headers(init.headers).entries())
 };
 if(key.legacy)headers.Authorization=`Bearer ${key.value}`;
 const response=await fetch(`${url()}/rest/v1/${path}`,{...init,headers,cache:"no-store"});
 if(!response.ok){
  const raw=await response.text();
  let code="unknown",message="Supabase request failed";
  try{const problem=JSON.parse(raw);code=String(problem.code||code);message=String(problem.message||message)}catch{}
  throw new SupabaseRequestError(path.split("?")[0],response.status,code,message);
 }
 const text=await response.text();
 return text?JSON.parse(text):null;
}

export const sha256=(value:string)=>createHash("sha256").update(value,"utf8").digest("hex");
export const generateQrToken=()=>`qrt_${randomBytes(32).toString("hex")}`;

export function passwordHash(value:string){
 const salt=randomBytes(16).toString("hex");
 return `scrypt:${salt}:${scryptSync(value,salt,32).toString("hex")}`;
}

export function passwordOk(value:string,stored:string){
 try{
  const parts=stored.split(":");
  const [salt,hex]=parts[0]==="scrypt"?[parts[1],parts[2]]:[parts[0],parts[1]];
  if(!salt||!hex||!/^[0-9a-f]{64}$/i.test(hex))return false;
  return timingSafeEqual(Buffer.from(hex,"hex"),scryptSync(value,salt,32));
 }catch{return false}
}

const sessionSecret=()=>{
 const value=process.env.STUDENT_SESSION_SECRET;
 if(!value||Buffer.byteLength(value,"utf8")<32)throw new Error("STUDENT_SESSION_SECRET must be at least 32 bytes");
 return value;
};

type StudentSession={studentId:string;classId:string;tokenVersion:number;exp:number};

export function signStudentSession(studentId:string,classId:string,tokenVersion:number){
 const body=Buffer.from(JSON.stringify({studentId,classId,tokenVersion,exp:Date.now()+12*60*60*1000})).toString("base64url");
 const signature=createHmac("sha256",sessionSecret()).update(`student:${body}`).digest("base64url");
 return `${body}.${signature}`;
}

export function verifyStudentSession(value:string):StudentSession|null{
 try{
  const [body,signature,...rest]=value.split(".");
  if(!body||!signature||rest.length)return null;
  const expected=createHmac("sha256",sessionSecret()).update(`student:${body}`).digest();
  const received=Buffer.from(signature,"base64url");
  if(received.length!==expected.length||!timingSafeEqual(received,expected))return null;
  const data=JSON.parse(Buffer.from(body,"base64url").toString("utf8")) as Partial<StudentSession>;
  if(typeof data.studentId!=="string"||typeof data.classId!=="string"||typeof data.tokenVersion!=="number"||typeof data.exp!=="number"||data.exp<=Date.now())return null;
  return data as StudentSession;
 }catch{return null}
}

type TeacherSession={teacherId:string;exp:number};

export function signTeacherSession(teacherId:string){
 const body=Buffer.from(JSON.stringify({teacherId,exp:Date.now()+12*60*60*1000})).toString("base64url");
 const signature=createHmac("sha256",sessionSecret()).update(`teacher:${body}`).digest("base64url");
 return `${body}.${signature}`;
}

export function verifyTeacherSession(value:string):TeacherSession|null{
 try{
  const [body,signature,...rest]=value.split(".");
  if(!body||!signature||rest.length)return null;
  const expected=createHmac("sha256",sessionSecret()).update(`teacher:${body}`).digest();
  const received=Buffer.from(signature,"base64url");
  if(received.length!==expected.length||!timingSafeEqual(received,expected))return null;
  const data=JSON.parse(Buffer.from(body,"base64url").toString("utf8")) as Partial<TeacherSession>;
  if(typeof data.teacherId!=="string"||typeof data.exp!=="number"||data.exp<=Date.now())return null;
  return data as TeacherSession;
 }catch{return null}
}

export async function verifiedTeacher(value:string){
 const session=verifyTeacherSession(value);
 if(!session)return null;
 const teacher=(await db(`teachers?id=eq.${encodeURIComponent(session.teacherId)}&select=id,teacher_code`))[0];
 return teacher?{session,teacher}:null;
}
export async function verifiedStudent(value:string){
 const session=verifyStudentSession(value);
 if(!session)return null;
 const student=(await db(`students?id=eq.${encodeURIComponent(session.studentId)}&class_id=eq.${encodeURIComponent(session.classId)}&active=eq.true&select=id,class_id,external_id,name,avatar,active`))[0];
 if(!student)return null;
 const credential=(await db(`student_access_credentials?student_id=eq.${encodeURIComponent(student.id)}&qr_active=eq.true&token_version=eq.${session.tokenVersion}&select=student_id`))[0];
 return credential?{session,student}:null;
}
