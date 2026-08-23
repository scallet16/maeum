import assert from "node:assert/strict";
import {addSticker,moveSticker,removeSticker,resizeSticker} from "../lib/editor-rules.ts";
let items=addSticker([],"😊",1);assert.equal(items[0].x>=42&&items[0].x<=58,true);assert.equal(items[0].y>=42&&items[0].y<=58,true);
items=addSticker(items,"🌱",2);assert.equal(items.length,2);assert.notEqual(items[0].id,items[1].id);
const first=items[0].id,second=items[1].id,secondBefore={...items[1]};items=moveSticker(items,first,81,23);assert.equal(items[0].x,81);assert.equal(items[0].y,23);assert.deepEqual(items[1],secondBefore);
items=moveSticker(items,first,-20,200);assert.equal(items[0].x,4);assert.equal(items[0].y,93);
items=resizeSticker(items,first,-100);assert.equal(items[0].size,32);items=resizeSticker(items,first,200);assert.equal(items[0].size,96);
items=removeSticker(items,first);assert.equal(items.length,1);assert.equal(items[0].id,second);
console.log("Touch editor sticker checks passed");
