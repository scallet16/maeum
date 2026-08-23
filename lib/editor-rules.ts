import type {Sticker} from "./demo-v3.ts";
export function addSticker(items:Sticker[],value:string,seed=Date.now()){const offset=((items.length%5)-2)*4;return[...items,{id:`sticker-${seed}-${items.length}`,value,x:50+offset,y:50-offset,size:56}]}
export function moveSticker(items:Sticker[],id:string,x:number,y:number){return items.map(s=>s.id===id?{...s,x:Math.max(4,Math.min(96,x)),y:Math.max(7,Math.min(93,y))}:s)}
export function resizeSticker(items:Sticker[],id:string,amount:number){return items.map(s=>s.id===id?{...s,size:Math.max(32,Math.min(96,s.size+amount))}:s)}
export function removeSticker(items:Sticker[],id:string){return items.filter(s=>s.id!==id)}
