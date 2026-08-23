import assert from "node:assert/strict";
import {demoAuthService,initialDemoState} from "../lib/demo-v5.ts";
let state=initialDemoState();
const ids=new Set(state.accounts.map(a=>a.teacherId)),codes=new Set(state.accounts.map(a=>a.classCode)),keys=new Set(state.accounts.map(a=>a.recoveryKey));
let created;
for(let i=0;i<30;i++){const result=demoAuthService.createClass(`새 학급 ${i}`,state);state=result.state;created=result.account;assert.equal(ids.has(created.teacherId),false);assert.equal(codes.has(created.classCode),false);assert.equal(keys.has(created.recoveryKey),false);ids.add(created.teacherId);codes.add(created.classCode);keys.add(created.recoveryKey);assert.match(created.teacherId,/^[A-Z2-9]{6}$/);assert.match(created.classCode,/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);assert.match(created.recoveryKey,/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);assert.match(created.password,/^\d{6}$/)}
assert.equal(demoAuthService.login(created.teacherId,created.password,state)?.mustChangePassword,true);
state=demoAuthService.setInitialPassword(created.classId,"new-pass",state);
assert.equal(demoAuthService.login(created.teacherId,created.password,state),null);
assert.equal(demoAuthService.login(created.teacherId,"new-pass",state)?.mustChangePassword,false);
state=demoAuthService.recover(created.teacherId,created.recoveryKey,"recovered",state);
assert.equal(demoAuthService.login(created.teacherId,"new-pass",state),null);
assert.equal(demoAuthService.login(created.teacherId,"recovered",state)?.classId,created.classId);
assert.throws(()=>demoAuthService.recover(created.teacherId,"WRONG-KEY0-0000","x",state));
console.log("Account issuance and recovery checks passed");
