/** Smart alignment guides for draggable text boxes on print preview. */

export type SnapGuides = {
  vertical: number[];
  horizontal: number[];
};

export type SnapRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

export const SNAP_THRESHOLD_PX = 10;

export function rectFromBox(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): SnapRect {
  return {
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    centerX: box.x + box.width / 2,
    centerY: box.y + box.height / 2,
  };
}

function dedupeSnapTargets(values: number[], epsilon = 0.75): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const value of sorted) {
    const last = out[out.length - 1];
    if (last == null || Math.abs(last - value) > epsilon) out.push(value);
  }
  return out;
}

export function collectSnapTargets(
  canvasW: number,
  canvasH: number,
  boxes: Array<{ id: string; box: { x: number; y: number; width: number; height: number } }>,
  excludeId: string
): { vertical: number[]; horizontal: number[] } {
  const vertical = [0, canvasW / 2, canvasW];
  const horizontal = [0, canvasH / 2, canvasH];

  for (const anchor of boxes) {
    if (anchor.id === excludeId) continue;
    const rect = rectFromBox(anchor.box);
    vertical.push(rect.left, rect.centerX, rect.right);
    horizontal.push(rect.top, rect.centerY, rect.bottom);
  }

  return {
    vertical: dedupeSnapTargets(vertical),
    horizontal: dedupeSnapTargets(horizontal),
  };
}

export function snapLayerRect(
  rect: SnapRect,
  targetsV: number[],
  targetsH: number[],
  thresholdPx: number
): { deltaX: number; deltaY: number; guides: SnapGuides } {
  let bestX: { delta: number; dist: number } | null = null;
  let bestY: { delta: number; dist: number } | null = null;

  const xEdges = [rect.left, rect.centerX, rect.right];
  const yEdges = [rect.top, rect.centerY, rect.bottom];

  for (const target of targetsV) {
    for (const edge of xEdges) {
      const dist = Math.abs(edge - target);
      if (dist <= thresholdPx && (!bestX || dist < bestX.dist)) {
        bestX = { delta: target - edge, dist };
      }
    }
  }

  for (const target of targetsH) {
    for (const edge of yEdges) {
      const dist = Math.abs(edge - target);
      if (dist <= thresholdPx && (!bestY || dist < bestY.dist)) {
        bestY = { delta: target - edge, dist };
      }
    }
  }

  const deltaX = bestX?.delta ?? 0;
  const deltaY = bestY?.delta ?? 0;
  const snapped: SnapRect = {
    left: rect.left + deltaX,
    top: rect.top + deltaY,
    right: rect.right + deltaX,
    bottom: rect.bottom + deltaY,
    centerX: rect.centerX + deltaX,
    centerY: rect.centerY + deltaY,
  };

  const vertical: number[] = [];
  const horizontal: number[] = [];

  if (bestX) {
    for (const target of targetsV) {
      if (
        Math.abs(snapped.left - target) <= 0.5 ||
        Math.abs(snapped.centerX - target) <= 0.5 ||
        Math.abs(snapped.right - target) <= 0.5
      ) {
        if (!vertical.some((v) => Math.abs(v - target) <= 0.5)) vertical.push(target);
      }
    }
  }

  if (bestY) {
    for (const target of targetsH) {
      if (
        Math.abs(snapped.top - target) <= 0.5 ||
        Math.abs(snapped.centerY - target) <= 0.5 ||
        Math.abs(snapped.bottom - target) <= 0.5
      ) {
        if (!horizontal.some((v) => Math.abs(v - target) <= 0.5))
          horizontal.push(target);
      }
    }
  }

  return { deltaX, deltaY, guides: { vertical, horizontal } };
}

/** Draw bold snap guide lines on a 2D canvas overlay. */
export function drawSnapGuides(
  ctx: CanvasRenderingContext2D,
  guides: SnapGuides,
  width: number,
  height: number
) {
  if (!guides.vertical.length && !guides.horizontal.length) return;
  ctx.save();
  ctx.strokeStyle = "rgba(244, 114, 182, 1)";
  ctx.lineWidth = 1.25;
  ctx.shadowColor = "rgba(244, 114, 182, 0.55)";
  ctx.shadowBlur = 2;
  ctx.lineCap = "round";
  for (const gx of guides.vertical) {
    ctx.beginPath();
    ctx.moveTo(Math.round(gx) + 0.5, 0);
    ctx.lineTo(Math.round(gx) + 0.5, height);
    ctx.stroke();
  }
  for (const gy of guides.horizontal) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(gy) + 0.5);
    ctx.lineTo(width, Math.round(gy) + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}
