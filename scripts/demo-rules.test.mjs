import assert from "node:assert/strict";
import {demoAuthService,initialDemoState,releaseNextTreasures,sendNatureRecord,treasureReady} from "../lib/demo-v3.ts";

let state=initialDemoState();
assert.equal(demoAuthService.login("M7K4P2","1234",state)?.classId,"sun");
assert.equal(demoAuthService.login("M7K4P2","wrong",state),null);
assert.equal(state.classes.find(c=>c.id==="sun").students.some(s=>s.id.startsWith("star")),false);
state=demoAuthService.changePassword("sun","1234","5678",state);
assert.equal(demoAuthService.login("M7K4P2","1234",state),null);
assert.equal(demoAuthService.login("M7K4P2","5678",state)?.classId,"sun");

const sun=state.classes.find(c=>c.id==="sun"),sender=sun.students[0],targets=sun.students.slice(1);
for(const target of targets){({state}=sendNatureRecord(state,{id:`test-${target.id}`,classId:"sun",from:sender.id,to:target.id,image:"data:image/png;base64,demo",stickers:[],date:"test"}))}
assert.equal(state.rounds[sender.id],2);
({state}=sendNatureRecord(state,{id:"round-2",classId:"sun",from:sender.id,to:targets[0].id,image:"demo",stickers:[],date:"test"}));
assert.throws(()=>sendNatureRecord(state,{id:"duplicate",classId:"sun",from:sender.id,to:targets[0].id,image:"demo",stickers:[],date:"test"}));

state={...state,natureCards:[]};
let id=0;
for(const receiver of sun.students){for(let n=0;n<2;n++)state.natureCards.push({id:`treasure-${id++}`,classId:"sun",from:sun.students[(id+1)%sun.students.length].id,to:receiver.id,image:"demo",stickers:[],date:"test",round:1,selectionOrder:n+1})}
state.natureCards.push({id:"extra-1",classId:"sun",from:sun.students[1].id,to:sun.students[0].id,image:"demo",stickers:[],date:"test",round:2,selectionOrder:1});
assert.equal(treasureReady(state,"sun"),true);
state=releaseNextTreasures(state,"sun");
for(const receiver of sun.students)assert.equal(state.natureCards.filter(c=>c.to===receiver.id&&c.releasedBatch===1).length,2);
assert.equal(state.natureCards.find(c=>c.id==="extra-1").releasedBatch,undefined);
assert.equal(treasureReady(state,"sun"),false);
console.log("Demo rule checks passed");
