import type {DemoState} from "./demo-v6";

export const cloudConfigured=()=>Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export async function createCloudTeacherRegistration(className:string){
 try{
  const response=await fetch("/api/teacher/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({className})});
  if(!response.ok)throw new Error("지금은 우리 반 우체국을 만들지 못했어요. 다시 시도해 주세요.");
  return response.json() as Promise<{ok:true;teacherCode:string;initialPassword:string;recoveryKey:string;classData:{id:string;name:string;classCode:string;features:Record<string,boolean>}}>;
 }catch(error){
  if(error instanceof Error&&error.message==="지금은 우리 반 우체국을 만들지 못했어요. 다시 시도해 주세요.")throw error;
  throw new Error("지금은 우리 반 우체국을 만들지 못했어요. 다시 시도해 주세요.");
 }
}

export async function createCloudStudent(classId:string){
 const response=await fetch("/api/teacher/students",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({classId})});
 if(!response.ok)throw new Error(response.status===409?"활성 원아는 한 학급에 최대 25명까지 등록할 수 있어요.":"원아를 저장하지 못했어요. 다시 시도해 주세요.");
 return response.json() as Promise<{ok:true;student:{id:string;name:string;avatar:string;active:true;attendance:"present"};credential:{studentId:string;studentCode:string;initialPin:string;qrToken:string;version:number}}>;
}

export async function resetCloudStudentPin(classId:string,studentId:string){
 const response=await fetch("/api/teacher/students",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({classId,studentId,action:"reset_pin"})});
 if(!response.ok)throw new Error("새 PIN을 만들지 못했어요. 다시 시도해 주세요.");
 return response.json() as Promise<{ok:true;studentCode:string;initialPin:string}>;
}

export async function resetCloudStudentQr(classId:string,studentId:string){
 const response=await fetch("/api/teacher/students",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({classId,studentId,action:"reset_qr"})});
 if(!response.ok)throw new Error("새 QR을 만들지 못했어요. 다시 시도해 주세요.");
 return response.json() as Promise<{ok:true;studentCode:string;qrToken:string;version:number}>;
}

export async function syncClassToCloud(state:DemoState,classId:string){
 const cls=state.classes.find(item=>item.id===classId);
 const account=state.accounts.find(item=>item.classId===classId);
 if(!cloudConfigured()||!cls||!account||["sun","star","sprout"].includes(classId)||sessionStorage.getItem("maeum-role")!=="teacher")return null;
 const response=await fetch("/api/cloud/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
  teacherId:account.teacherId,
  password:account.password,
  recoveryKey:account.recoveryKey,
  classData:{id:cls.id,name:cls.name,classCode:account.classCode,features:state.features[classId]},
  students:cls.students,
  credentials:state.studentCredentials.filter(item=>item.classId===classId&&!item.cloudManaged),
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
 const moodHistory=[...base.moodHistory.filter(item=>!(item.classId===classId&&item.ownerId===studentId)),...snapshot.moods],gallery=snapshot.publicGallery||{},dedupe=(items:any[])=>[...new Map(items.map(item=>[item.id,item])).values()];
 return{...base,classes,moodHistory,friendRecords:[...base.friendRecords.filter(x=>x.classId!==classId),...(snapshot.friendRecords||[])],natureCards:[...base.natureCards.filter(x=>x.classId!==classId),...dedupe([...(snapshot.natureCards||[]),...(gallery.natureCards||[])])],personalEntries:[...base.personalEntries.filter(x=>x.classId!==classId),...dedupe([...(snapshot.personalEntries||[]),...(gallery.personalEntries||[])])],teacherDiscoveries:[...base.teacherDiscoveries.filter(x=>x.classId!==classId),...(gallery.teacherDiscoveries||[])],galleryReactions:[...base.galleryReactions.filter(x=>x.classId!==classId),...(gallery.ownReactions||[])],galleryReactionCounts:{...base.galleryReactionCounts,...Object.fromEntries([...(gallery.natureCards||[]),...(gallery.personalEntries||[]),...(gallery.teacherDiscoveries||[])].map((item:any)=>[item.id,0])),...(gallery.reactionCounts||{})},moods:{...base.moods,...Object.fromEntries(snapshot.moods.slice(-1).map((mood:any)=>[mood.ownerId,{a:mood.a,b:mood.b,note:mood.note,date:mood.date}]))},features:{...base.features,[classId]:{mood:true,friend:true,nature:true,capture:true,discovery:true,treasure:true,galleryReaction:true,teacherLetter:true,...snapshot.classData.features}},accessSettings:{...base.accessSettings,[classId]:{qrEnabled:true,codeEnabled:true,sharedDevice:true,homeQrAllowed:true,teacherPin:"2468"}},galleryReactionSettings:{...base.galleryReactionSettings,[classId]:{flowerEnabled:true,monthlySharerEnabled:true,exactCountsVisible:false,flowerThreshold:5,sharerThreshold:5}},classAccessibility:{...base.classAccessibility,[classId]:{largeTargets:false,audioPrompts:true,simplifiedChoices:false,pictureGuidance:true,reducedMotion:false,extendedTimeout:false,tapAlternativeToDrag:true,teacherHelp:true}},discoveryTopics:{...base.discoveryTopics,[classId]:{title:"오늘의 발견",guide:"오늘 발견한 것을 너만의 방법으로 담아볼까요?",emoji:"🔎",startDate:"",endDate:""}}};
}

export async function syncStudentMood(entry:any):Promise<{ok:true;media:Record<string,string>;mediaFailed:string[]}|null>{
 if(!cloudConfigured())return null;
 const response=await fetch("/api/student/moods",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(entry)});
 if(!response.ok)throw new Error("student mood sync failed");
 if(!entry.audio&&!entry.image&&!entry.drawing)return {ok:true,media:{},mediaFailed:[]};
 const mediaResponse=await fetch("/api/student/mood-media",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:entry.id,audio:entry.audio,image:entry.image,drawing:entry.drawing,audioDurationMs:entry.audioDurationMs})});
 if(!mediaResponse.ok)throw new Error("마음은 저장했어요. 목소리는 다시 한번 담아볼까요?");
 return mediaResponse.json() as Promise<{ok:true;media:Record<string,string>;mediaFailed:string[]}>;
}

export async function pullCloudMoods(state:DemoState,classId:string){
 const account=state.accounts.find(item=>item.classId===classId);
 if(!cloudConfigured()||!account)return null;
 const response=await fetch("/api/cloud/pull",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({classId})});
 if(!response.ok)return null;
 return response.json();
}

export function mergeTeacherCloudMoods(state:DemoState,classId:string,payload:any):DemoState{
 const remote=payload?.moods||[];

 const letters=payload?.letters||[];
 const summaries=Object.fromEntries([...remote].sort((a:any,b:any)=>a.createdAt-b.createdAt).map((mood:any)=>[mood.ownerId,{a:mood.a,b:mood.b,note:mood.note,date:mood.date}]));
 return{...state,moods:{...state.moods,...summaries},moodHistory:[...state.moodHistory.filter(mood=>mood.classId!==classId),...remote],friendRecords:[...state.friendRecords.filter(x=>x.classId!==classId),...(payload.friendRecords||[])],natureCards:[...state.natureCards.filter(x=>x.classId!==classId),...(payload.natureCards||[])],personalEntries:[...state.personalEntries.filter(x=>x.classId!==classId),...(payload.personalEntries||[])],teacherDiscoveries:[...state.teacherDiscoveries.filter(x=>x.classId!==classId),...(payload.teacherDiscoveries||[])],galleryReactions:[...state.galleryReactions.filter(x=>x.classId!==classId),...(payload.galleryReactions||[])],galleryReactionCounts:{...state.galleryReactionCounts,...Object.fromEntries([...(payload.natureCards||[]),...(payload.personalEntries||[]),...(payload.teacherDiscoveries||[])].map((item:any)=>[item.id,0])),...Object.fromEntries(Object.entries((payload.galleryReactions||[]).reduce((acc:Record<string,number>,row:any)=>(acc[row.galleryItemId]=(acc[row.galleryItemId]||0)+1,acc),{})))},teacherLetters:[...state.teacherLetters.filter(letter=>letter.classId!==classId),...letters]};
}
export async function createCloudTeacherSession(teacherId:string,password:string){
 if(!cloudConfigured())return {ok:true,demo:true};
 try{const response=await fetch("/api/teacher/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teacherId,password})});if(!response.ok)return null;return response.json()}catch{return null}
}

export function mergeTeacherBootstrap(base:DemoState,payload:any,password:string):DemoState{
 const remoteClasses=(payload?.classes||[]) as any[],remoteIds=new Set(remoteClasses.map(item=>item.id)),remoteStudentIds=new Set(remoteClasses.flatMap(item=>item.students.map((student:any)=>student.id)));
 const classes=[...base.classes.filter(item=>!remoteIds.has(item.id)),...remoteClasses.map(item=>({id:item.id,name:item.name,students:item.students}))];
 const accounts=[...base.accounts.filter(item=>!remoteIds.has(item.classId)),...remoteClasses.map(item=>{const existing=base.accounts.find(account=>account.classId===item.id);return{classId:item.id,teacherId:payload.teacherCode,password,classCode:item.classCode,recoveryKey:existing?.recoveryKey||payload.recoveryKey||"",mustChangePassword:payload.mustChangePassword??existing?.mustChangePassword??false,cloudManaged:true}})];
 const credentials=[...base.studentCredentials.filter(item=>!remoteStudentIds.has(item.studentId)),...remoteClasses.flatMap(item=>item.credentials.map((credential:any)=>{const existing=base.studentCredentials.find(item=>item.studentId===credential.studentId),trusted=existing?.cloudManaged&&existing.version===credential.version;return{studentId:credential.studentId,classId:item.id,qrToken:trusted?existing.qrToken:"",personalCode:existing?.personalCode||"",studentCode:credential.studentCode,pin:trusted&&existing.studentCode===credential.studentCode?existing.pin:"",version:credential.version,cloudManaged:true}}))];
 return{...base,classes,accounts,studentCredentials:credentials,features:{...base.features,...Object.fromEntries(remoteClasses.map(item=>[item.id,{mood:true,friend:true,nature:true,capture:true,discovery:true,treasure:true,galleryReaction:true,teacherLetter:true,...item.features}]))},accessSettings:{...base.accessSettings,...Object.fromEntries(remoteClasses.map(item=>[item.id,base.accessSettings[item.id]||{qrEnabled:true,codeEnabled:true,sharedDevice:true,homeQrAllowed:true,teacherPin:"2468"}]))},galleryReactionSettings:{...base.galleryReactionSettings,...Object.fromEntries(remoteClasses.map(item=>[item.id,base.galleryReactionSettings[item.id]||{flowerEnabled:true,monthlySharerEnabled:true,exactCountsVisible:false,flowerThreshold:5,sharerThreshold:5}]))},classAccessibility:{...base.classAccessibility,...Object.fromEntries(remoteClasses.map(item=>[item.id,base.classAccessibility[item.id]||{largeTargets:false,audioPrompts:true,simplifiedChoices:false,pictureGuidance:true,reducedMotion:false,extendedTimeout:false,tapAlternativeToDrag:true,teacherHelp:true}]))},discoveryTopics:{...base.discoveryTopics,...Object.fromEntries(remoteClasses.map(item=>[item.id,base.discoveryTopics[item.id]||{title:"오늘의 발견",guide:"오늘 발견한 것을 너만의 방법으로 담아볼까요?",emoji:"🔎",startDate:"",endDate:""}]))}};
}

export async function recoverCloudTeacherPassword(teacherId:string,recoveryKey:string,newPassword:string){
 try{const response=await fetch("/api/teacher/recover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teacherId,recoveryKey,newPassword})});if(response.status===401)throw new Error("교사 ID와 복구키를 다시 확인해 주세요.");if(response.status===429)throw new Error("잠시 후 다시 시도해 주세요.");if(!response.ok)throw new Error("지금은 비밀번호를 바꾸지 못했어요. 다시 시도해 주세요.");return response.json()}catch(error){if(error instanceof Error&&["교사 ID와 복구키를 다시 확인해 주세요.","잠시 후 다시 시도해 주세요.","지금은 비밀번호를 바꾸지 못했어요. 다시 시도해 주세요."].includes(error.message))throw error;throw new Error("지금은 비밀번호를 바꾸지 못했어요. 다시 시도해 주세요.")}
}

export async function changeCloudTeacherPassword(currentPassword:string,newPassword:string){
 const response=await fetch("/api/teacher/session",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword,newPassword})});
 if(!response.ok)throw new Error(response.status===401?"현재 비밀번호가 맞지 않아요.":"비밀번호를 서버에 저장하지 못했어요.");
 return response.json();
}
export async function verifyCloudTeacherSession(){
 if(!cloudConfigured())return sessionStorage.getItem("maeum-role")==="teacher";
 const response=await fetch("/api/teacher/session",{cache:"no-store"});
 return response.ok;
}

export async function endCloudTeacherSession(){
 if(cloudConfigured())await fetch("/api/teacher/session",{method:"DELETE"});
}

export async function endCloudStudentSession(){
 if(cloudConfigured())await fetch("/api/student/session",{method:"DELETE"});
}

export async function sendCloudTeacherFeedback(letter:any){
 const response=await fetch("/api/teacher/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(letter)});
 if(!response.ok)throw new Error("마음편지를 Supabase에 저장하지 못했어요.");
 return response.json();
}

export async function pullStudentFeedback(){
 const response=await fetch("/api/student/feedback",{cache:"no-store"});
 if(!response.ok)return null;
 return response.json();
}

export async function markStudentFeedbackRead(id:string){
 const response=await fetch("/api/student/feedback",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
 if(!response.ok)throw new Error("마음편지 확인 상태를 저장하지 못했어요.");
}
export async function saveCloudStudentRecord(kind:string,record:any){
 const response=await fetch("/api/student/records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,record})});
 if(!response.ok)throw new Error("저장하지 못했어요. 작업은 그대로 두었어요. 다시 해볼까요?");
 return (await response.json()).record;
}

export async function saveCloudTeacherDiscovery(record:any){
 const response=await fetch("/api/teacher/gallery/discovery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(record)});
 if(!response.ok)throw new Error("선생님의 발견을 저장하지 못했어요. 작업은 그대로 두었어요.");
 return (await response.json()).record;
}

export async function approveCloudGallery(kind:"nature"|"capture"|"discovery",id:string){const response=await fetch("/api/teacher/gallery/approve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,id})});if(!response.ok)throw new Error("승인하지 못했어요. 다시 시도해 주세요.");return response.json()}
export async function toggleCloudGalleryReaction(galleryItemId:string){const response=await fetch("/api/student/gallery/reaction",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({galleryItemId})});if(!response.ok)throw new Error("공감을 저장하지 못했어요. 다시 눌러 주세요.");return response.json()}
