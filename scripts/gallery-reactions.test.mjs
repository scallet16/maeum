import assert from "node:assert/strict";
import {ensureCredentials,initialDemoState,monthlyReactionSummary,publicGalleryItems,reactionCountForItem,resolveStudentByCode,resolveStudentByQr,toggleGalleryReaction} from "../lib/demo-v6.ts";
let state=ensureCredentials(initialDemoState());
const classA=state.classes[0],classB=state.classes[1],studentA=classA.students[0],studentB=classA.students[1],studentC=classA.students[2],credential=state.studentCredentials.find(c=>c.studentId===studentA.id);
const approved={id:"approved-friend",classId:classA.id,ownerId:studentC.id,kind:"capture",title:"공개 작품",image:"data:",stickers:[],date:"today",createdAt:1,privacyLevel:"class_share",teacherApproved:true};
const mine={...approved,id:"approved-mine",ownerId:studentA.id};
const waiting={...approved,id:"waiting",teacherApproved:false};
const privateItem={...approved,id:"private",privacyLevel:"teacher_private",teacherApproved:true};
const otherClass={...approved,id:"other-class",classId:classB.id,ownerId:classB.students[0].id};
state={...state,personalEntries:[...state.personalEntries,approved,mine,waiting,privateItem,otherClass]};
assert.deepEqual(publicGalleryItems(state,classA.id).map(x=>x.id).sort(),[approved.id,mine.id].sort());
state=toggleGalleryReaction(state,classA.id,studentA.id,approved.id);assert.equal(state.galleryReactions.length,1);assert.equal(state.galleryReactions[0].studentId,studentA.id);
state=toggleGalleryReaction(state,classA.id,studentA.id,approved.id);assert.equal(state.galleryReactions.length,0);
state=toggleGalleryReaction(state,classA.id,studentA.id,approved.id);state=toggleGalleryReaction(state,classA.id,studentB.id,approved.id);assert.equal(state.galleryReactions.length,2);
const beforeMine=state.galleryReactions.length;state=toggleGalleryReaction(state,classA.id,studentA.id,mine.id);assert.equal(state.galleryReactions.length,beforeMine);
for(const blocked of [waiting.id,privateItem.id,otherClass.id]){const before=state.galleryReactions.length;state=toggleGalleryReaction(state,classA.id,studentA.id,blocked);assert.equal(state.galleryReactions.length,before)}
const qr=resolveStudentByQr(state,credential.qrToken),code=resolveStudentByCode(state,credential.studentCode,credential.pin);assert.equal(qr.student.id,code.student.id);assert.equal(state.galleryReactions.some(r=>r.studentId===qr.student.id&&r.galleryItemId===approved.id),true);
const saved=[...state.galleryReactions];state={...state,features:{...state.features,[classA.id]:{...state.features[classA.id],galleryReaction:false}}};assert.deepEqual(state.galleryReactions,saved);state={...state,features:{...state.features,[classA.id]:{...state.features[classA.id],galleryReaction:true}}};assert.deepEqual(state.galleryReactions,saved);
const month="2026-08",monthTime=Date.parse("2026-08-15T00:00:00Z"),studentD=classA.students[3];
const byB1={...approved,id:"by-b-1",ownerId:studentB.id},byB2={...approved,id:"by-b-2",ownerId:studentB.id},byC2={...approved,id:"by-c-2",ownerId:studentC.id};
state={...state,personalEntries:[...state.personalEntries,byB1,byB2,byC2],galleryReactionSettings:{...state.galleryReactionSettings,[classA.id]:{...state.galleryReactionSettings[classA.id],flowerThreshold:2,sharerThreshold:2}},galleryReactions:[
{id:"m1",classId:classA.id,galleryItemId:byB1.id,studentId:studentA.id,reactionType:"heart",createdAt:monthTime},
{id:"m2",classId:classA.id,galleryItemId:byB2.id,studentId:studentA.id,reactionType:"heart",createdAt:monthTime},
{id:"m3",classId:classA.id,galleryItemId:byC2.id,studentId:studentA.id,reactionType:"heart",createdAt:monthTime},
{id:"m4",classId:classA.id,galleryItemId:mine.id,studentId:studentB.id,reactionType:"heart",createdAt:monthTime},
{id:"m5",classId:classA.id,galleryItemId:byC2.id,studentId:studentB.id,reactionType:"heart",createdAt:monthTime},
{id:"m6",classId:classA.id,galleryItemId:byB1.id,studentId:studentC.id,reactionType:"heart",createdAt:monthTime},
{id:"m7",classId:classA.id,galleryItemId:mine.id,studentId:studentC.id,reactionType:"heart",createdAt:monthTime},
{id:"old",classId:classA.id,galleryItemId:byB1.id,studentId:studentD.id,reactionType:"heart",createdAt:Date.parse("2026-07-15T00:00:00Z")}
]};
const summary=monthlyReactionSummary(state,classA.id,month),summaryA=summary.find(x=>x.studentId===studentA.id),summaryB=summary.find(x=>x.studentId===studentB.id),summaryD=summary.find(x=>x.studentId===studentD.id);
assert.equal(summaryA.distinctFriends,2);assert.equal(summaryA.reactionsSent,3);assert.equal(summaryB.distinctFriends,2);assert.equal(summaryD.distinctFriends,0);
assert.equal(summary.filter(x=>x.distinctFriends>=2).length>=2,true);
assert.equal(reactionCountForItem(state,classA.id,byB1.id),3);assert.equal(reactionCountForItem(state,classA.id,mine.id),2);
assert.equal(publicGalleryItems(state,classA.id).filter(item=>reactionCountForItem(state,classA.id,item.id)>=2).length>=2,true);
assert.equal(state.galleryReactionSettings[classA.id].exactCountsVisible,false);
assert.equal(Object.keys(state).some(key=>/rank|popular|score/i.test(key)),false);
console.log("Non-competitive gallery reaction checks passed");