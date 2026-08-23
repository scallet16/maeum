import {demoClasses} from "./demo-data";
export type Attendance="present"|"absent"|"excluded";
export type ManagedStudent={id:string;name:string;avatar:string;active:boolean;attendance:Attendance};
export type ManagedClass={id:string;name:string;students:ManagedStudent[]};
export type MoodRecord={a:string;b:string;note:string;drawing?:string;audio?:string;date:string};
export type FriendRecord={id:string;from:string;to:string;text?:string;drawing?:string;audio?:string;date:string};
export type NatureRecord={id:string;from:string;to:string;image:string;emoji:string;date:string};
export type DemoState={classes:ManagedClass[];moods:Record<string,MoodRecord>;friendRecords:FriendRecord[];natureCards:NatureRecord[];notes:Record<string,string>};
export interface DemoRepository{load():DemoState;save(state:DemoState):void}
export const initialDemoState=():DemoState=>({classes:demoClasses.map(c=>({...c,students:c.students.map(s=>({...s,active:true,attendance:"present" as const}))})),moods:{},friendRecords:[],natureCards:[],notes:{}});
const key="maeum-demo-v2";
export const localDemoRepository:DemoRepository={load(){if(typeof window==="undefined")return initialDemoState();try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):initialDemoState()}catch{return initialDemoState()}},save(state){if(typeof window!=="undefined")localStorage.setItem(key,JSON.stringify(state))}};
export const studentAvatars=["🐻","🐰","🦊","🐼","🐯","🐨","🐸","🐧","🦁","🐹","🐶","🐱","🦋","🐢","🐿️"];
