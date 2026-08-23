export type Student={id:string;name:string;avatar:string}; export type DemoClass={id:string;name:string;students:Student[]};
const names=["가온","나래","다온","라온","마루","보미","새봄","서우","윤슬","지우","하람","해나","도윤","민서","유주","시우","서윤","지민","은우","수아","예준","채원","현우","소율","태오"];
const avatars=["🐻","🐰","🦊","🐼","🐯","🐨","🐸","🐧","🦁","🐹","🐶","🐱"];
const make=(p:string,n:number)=>names.slice(0,n).map((name,i)=>({id:`${p}-${i+1}`,name,avatar:avatars[i%avatars.length]}));
export const demoClasses:DemoClass[]=[{id:"sun",name:"햇님반",students:make("sun",15)},{id:"star",name:"별님반",students:make("star",22)},{id:"sprout",name:"새싹반",students:make("sprout",25)}];
export const feelings=["😊","😢","😠","😨","😳","🥰","🥺","🤔","😌","😂","😴","😐","😮","😟","😆"];
export const symbols=["🌱","🌸","🌼","🍀","🍂","🌳","☀️","🌈","☁️","🌧️","🌊","⭐","🦋","🌙","💧","🔥"];
export const assignments=(ss:Student[])=>new Map(ss.length<2?[]:ss.map((s,i)=>[s.id,ss[(i+1)%ss.length].id]));