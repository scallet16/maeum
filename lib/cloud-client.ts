import type {DemoState} from "./demo-v6";

export const cloudConfigured=()=>Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export async function syncClassToCloud(state:DemoState,classId:string){
 const cls=state.classes.find(item=>item.id===classId);
 const account=state.accounts.find(item=>item.classId===classId);
 if(!cloudConfigured()||!cls||!account||["sun","star","sprout"].includes(classId))return null;
 const response=await fetch("/api/cloud/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
  teacherId:account.teacherId,
  password:account.password,
  recoveryKey:account.recoveryKey,
  classData:{id:cls.id,name:cls.name,classCode:account.classCode,features:state.features[classId]},
  students:cls.students,
  credentials:state.studentCredentials.filter(item=>item.classId===classId),
  moods:state.moodHistory.filter(item=>item.classId===classId)
 })});
 if(!response.ok){
  const problem=await response.json().catch(()=>({}));
  const detail=[problem.stage,problem.table,problem.status,problem.code].filter(Boolean).join(" / ");
  throw new Error(detail?`Cloud Sync 실패 (${detail})`:"Cloud Sync 실패");
 }
 return response.json() as Promise<{ok:true;issuedQrTokens:{studentId:string;qrToken:string;version:number}[]}>;
}

export async function resolveCloudQr(token:string){
 const response=await fetch(`/api/student/resolve/${encodeURIComponent(token)}`,{cache:"no-store"});
 if(!response.ok)return null;
 return response.json();
}

export async function resolveCloudSession(){
 const response=await fetch("/api/student/session",{cache:"no-store"});
 if(!response.ok)return null;
 return response.json();
}
export async function resolveCloudCode(studentCode:string,pin:string){
 const response=await fetch("/api/student/code",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentCode,pin})});
 if(!response.ok)return null;
 return response.json();
}

export function mergeCloudSnapshot(base:DemoState,snapshot:any):DemoState{
 const classId=snapshot.classData.id;
 const studentId=snapshot.student.id;
 const classes=[...base.classes.filter(item=>item.id!==classId),{id:classId,name:snapshot.classData.name,students:snapshot.classData.students}];
 const moodHistory=[...base.moodHistory.filter(item=>!(item.classId===classId&&item.ownerId===studentId)),...snapshot.moods];
 return{...base,classes,moodHistory,moods:{...base.moods,...Object.fromEntries(snapshot.moods.slice(-1).map((mood:any)=>[mood.ownerId,{a:mood.a,b:mood.b,note:mood.note,date:mood.date}]))},features:{...base.features,[classId]:{mood:true,friend:true,nature:true,capture:true,discovery:true,treasure:true,galleryReaction:true,...snapshot.classData.features}},accessSettings:{...base.accessSettings,[classId]:{qrEnabled:true,codeEnabled:true,sharedDevice:true,homeQrAllowed:true,teacherPin:"2468"}},galleryReactionSettings:{...base.galleryReactionSettings,[classId]:{flowerEnabled:true,monthlySharerEnabled:true,exactCountsVisible:false,flowerThreshold:5,sharerThreshold:5}},classAccessibility:{...base.classAccessibility,[classId]:{largeTargets:false,audioPrompts:true,simplifiedChoices:false,pictureGuidance:true,reducedMotion:false,extendedTimeout:false,tapAlternativeToDrag:true,teacherHelp:true}},discoveryTopics:{...base.discoveryTopics,[classId]:{title:"오늘의 발견",guide:"오늘 발견한 것을 너만의 방법으로 담아볼까요?",emoji:"🔎",startDate:"",endDate:""}}};
}

export async function syncStudentMood(entry:any){
 if(!cloudConfigured())return;
 const response=await fetch("/api/student/moods",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(entry)});
 if(!response.ok)throw new Error("student mood sync failed");
}

export async function pullCloudMoods(state:DemoState,classId:string){
 const account=state.accounts.find(item=>item.classId===classId);
 if(!cloudConfigured()||!account)return null;
 const response=await fetch("/api/cloud/pull",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teacherId:account.teacherId,password:account.password,classId})});
 if(!response.ok)return null;
 return response.json();
}

export function mergeTeacherCloudMoods(state:DemoState,classId:string,payload:any):DemoState{
 const remote=payload?.moods||[];

 return{...state,moodHistory:[...state.moodHistory.filter(mood=>mood.classId!==classId),...remote]};
}
