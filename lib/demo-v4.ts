import {demoAccounts,initialDemoState as initialV3,demoAuthService as baseAuth,releaseNextTreasures as baseRelease,sendNatureRecord as baseSend,studentAvatars,treasureReady as baseTreasureReady,type DemoState as V3State,type ManagedStudent,type NatureRecord as V3Nature} from "./demo-v3.ts";
export {demoAccounts,studentAvatars};export type {ManagedStudent};
export type PrivacyLevel="class_share"|"teacher_private"|"self_only";
export type FeatureKey="mood"|"friend"|"nature"|"capture"|"discovery"|"treasure"|"galleryReaction";
export type FeatureSettings=Record<FeatureKey,boolean>;
export type MoodEntry={id:string;classId:string;ownerId:string;a:string;b:string;note:string;drawing?:string;audio?:string;date:string;createdAt:number;privacyLevel:PrivacyLevel};
export type PersonalEntry={id:string;classId:string;ownerId:string;kind:"capture"|"discovery";title:string;image:string;drawing?:string;backgroundColor?:string;stickers:{id:string;value:string;x:number;y:number;size:number}[];audio?:string;emoji?:string;date:string;createdAt:number;privacyLevel:PrivacyLevel;teacherApproved:boolean};
export type DiscoveryTopic={title:string;guide:string;emoji:string;startDate:string;endDate:string;audio?:string};
export type NatureRecord=V3Nature&{classShareRequested?:boolean;teacherApproved?:boolean};
export type DemoState=Omit<V3State,"natureCards">&{natureCards:NatureRecord[];moodHistory:MoodEntry[];personalEntries:PersonalEntry[];features:Record<string,FeatureSettings>;discoveryTopics:Record<string,DiscoveryTopic>};
export const demoAuthService={login:baseAuth.login,changePassword(classId:string,current:string,next:string,state:DemoState){return baseAuth.changePassword(classId,current,next,state) as DemoState}};
export function sendNatureRecord(state:DemoState,input:Omit<NatureRecord,"round"|"selectionOrder"|"releasedBatch">){const result=baseSend(state,input);return{state:result.state as DemoState,roundCompleted:result.roundCompleted}}
export function treasureReady(state:DemoState,classId:string){return baseTreasureReady(state,classId)}
export function releaseNextTreasures(state:DemoState,classId:string){return baseRelease(state,classId) as DemoState}
const allOn:FeatureSettings={mood:true,friend:true,nature:true,capture:true,discovery:true,treasure:true,galleryReaction:true};
export const initialDemoState=():DemoState=>({...initialV3(),moodHistory:[],personalEntries:[],features:{sun:{...allOn},star:{...allOn},sprout:{...allOn}},discoveryTopics:{sun:{title:"하늘",guide:"오늘 하늘을 너만의 방법으로 담아볼까요?",emoji:"☁️",startDate:"",endDate:""},star:{title:"반짝이는 것",guide:"반짝이는 것을 찾아볼까요?",emoji:"✨",startDate:"",endDate:""},sprout:{title:"작은 것",guide:"작은 발견을 담아볼까요?",emoji:"🔎",startDate:"",endDate:""}}});
const key="maeum-demo-v4";
export const localDemoRepository={load(){if(typeof window==="undefined")return initialDemoState();try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):initialDemoState()}catch{return initialDemoState()}},save(state:DemoState){if(typeof window!=="undefined")localStorage.setItem(key,JSON.stringify(state))}};
export type Viewer={role:"student"|"teacher"|"peer"|"parent"|"public";studentId?:string;classId?:string};
export function canView(entry:{ownerId:string;classId?:string;privacyLevel:PrivacyLevel;teacherApproved?:boolean},viewer:Viewer){if(viewer.role==="student")return viewer.studentId===entry.ownerId;if(entry.classId&&viewer.classId!==entry.classId)return false;if(entry.privacyLevel==="self_only")return false;if(viewer.role==="teacher")return entry.privacyLevel==="class_share"||entry.privacyLevel==="teacher_private";if(viewer.role==="peer")return entry.privacyLevel==="class_share";if(viewer.role==="public")return entry.privacyLevel==="class_share"&&entry.teacherApproved===true;return false}
export function privacyLabel(level:PrivacyLevel){return level==="class_share"?"👀 함께 보기":level==="teacher_private"?"🧑‍🏫 선생님과 학생":"🔒 학생만"}
export function moodStats(entries:MoodEntry[]){const visible=entries.filter(e=>e.privacyLevel!=="self_only"),counts=visible.reduce<Record<string,number>>((a,e)=>(a[e.a]=(a[e.a]||0)+1,a),{});return{total:entries.length,classShare:entries.filter(e=>e.privacyLevel==="class_share").length,teacherPrivate:entries.filter(e=>e.privacyLevel==="teacher_private").length,selfOnly:entries.filter(e=>e.privacyLevel==="self_only").length,analyzable:visible.length,counts}}
