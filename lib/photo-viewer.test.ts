import assert from "node:assert/strict";
import test from "node:test";
import { clampPhotoTransform, INITIAL_PHOTO_TRANSFORM, photoSwipe, pinchPhotoTransform, wrapPhotoIndex } from "@/lib/photo-viewer";

test("photo navigation wraps in both directions, including empty/single-photo galleries", () => {
  assert.equal(wrapPhotoIndex(-1, 3), 2);
  assert.equal(wrapPhotoIndex(3, 3), 0);
  assert.equal(wrapPhotoIndex(19, 20), 19);
  assert.equal(wrapPhotoIndex(1, 0), 0);
  assert.equal(wrapPhotoIndex(-1, 1), 0);
});
test("horizontal swipes navigate, taps and page-scroll gestures do not", () => {
  const start = { x: 200, y: 300 };
  assert.equal(photoSwipe(start, { x: 100, y: 310 }), 1);
  assert.equal(photoSwipe(start, { x: 280, y: 300 }), -1);
  assert.equal(photoSwipe(start, { x: 175, y: 300 }), 0);
  assert.equal(photoSwipe(start, { x: 100, y: 150 }), 0);
  assert.equal(photoSwipe(start, start), 0);
});
test("zoom/pan bounds keep the actual fitted portrait or landscape within reach", () => {
  const stage = { x: 400, y: 600 };
  assert.deepEqual(clampPhotoTransform({zoom:1,x:100,y:200}, stage, stage), INITIAL_PHOTO_TRANSFORM);
  assert.deepEqual(clampPhotoTransform({zoom:2,x:999,y:-999},stage,{x:2000,y:1000}), {zoom:2,x:200,y:0});
  assert.deepEqual(clampPhotoTransform({zoom:2,x:999,y:-999},stage,{x:1000,y:2000}), {zoom:2,x:100,y:-300});
  assert.equal(clampPhotoTransform({zoom:10,x:0,y:0},stage,stage).zoom,4);
  assert.equal(clampPhotoTransform({zoom:0.2,x:0,y:0},stage,stage).zoom,1);
});
test("pinch scaling anchors the touched point and follows the fingers", () => {
  assert.deepEqual(pinchPhotoTransform(INITIAL_PHOTO_TRANSFORM,[{x:0,y:0},{x:100,y:0}],[{x:-50,y:0},{x:150,y:0}]),{zoom:2,x:-50,y:0});
  assert.deepEqual(pinchPhotoTransform(INITIAL_PHOTO_TRANSFORM,[{x:-50,y:0},{x:50,y:0}],[{x:0,y:20},{x:200,y:20}]),{zoom:2,x:100,y:20});
  const collapsed = pinchPhotoTransform(INITIAL_PHOTO_TRANSFORM,[{x:0,y:0},{x:0,y:0}],[{x:0,y:0},{x:10,y:0}]);
  assert.equal(collapsed.zoom,4);
  assert.ok(Number.isFinite(collapsed.x));
});
