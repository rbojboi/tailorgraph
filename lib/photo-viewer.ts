export type Point = { x: number; y: number };
export type PhotoTransform = Point & { zoom: number };
export const INITIAL_PHOTO_TRANSFORM: PhotoTransform = { zoom: 1, x: 0, y: 0 };

export function wrapPhotoIndex(index: number, count: number) {
  return count > 0 ? ((index % count) + count) % count : 0;
}

export function photoSwipe(start: Point, end: Point): -1 | 0 | 1 {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx < 0 ? 1 : -1) : 0;
}

export function clampPhotoTransform(transform: PhotoTransform, stage: Point, image: Point): PhotoTransform {
  const zoom = Math.max(1, Math.min(4, transform.zoom));
  if (zoom === 1 || stage.x <= 0 || stage.y <= 0 || image.x <= 0 || image.y <= 0) return { zoom, x: 0, y: 0 };
  const fit = Math.min(stage.x / image.x, stage.y / image.y);
  const boundX = Math.max(0, (image.x * fit * zoom - stage.x) / 2);
  const boundY = Math.max(0, (image.y * fit * zoom - stage.y) / 2);
  return { zoom, x: Math.max(-boundX, Math.min(boundX, transform.x)) || 0, y: Math.max(-boundY, Math.min(boundY, transform.y)) || 0 };
}

export function pinchPhotoTransform(start: PhotoTransform, from: [Point, Point], to: [Point, Point]): PhotoTransform {
  const distance = (points: [Point, Point]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const midpoint = (points: [Point, Point]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
  const zoom = Math.max(1, Math.min(4, start.zoom * distance(to) / Math.max(1, distance(from))));
  const before = midpoint(from), after = midpoint(to);
  return { zoom, x: after.x - (before.x - start.x) * zoom / start.zoom, y: after.y - (before.y - start.y) * zoom / start.zoom };
}
