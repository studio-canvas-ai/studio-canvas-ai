"use client";

/**
 * react-konva interactive stage with Transformer (bounding box).
 * Shared by AI Template Studio (utility) and Print Agent (agent).
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Stage, Layer, Image as KonvaImage, Text, Transformer, Rect } from "react-konva";
import type Konva from "konva";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import type { CanvasObject, CanvasTextObject } from "@/lib/canvas/types";
import { sortByZIndex } from "@/lib/canvas/types";
import { EMOJI_FONT } from "@/lib/thumbnailStyles";

const CHECKER: CSSProperties = {
  backgroundColor: "#1a1d27",
  backgroundImage:
    "linear-gradient(45deg, #2a2f3d 25%, transparent 25%), linear-gradient(-45deg, #2a2f3d 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2f3d 75%), linear-gradient(-45deg, transparent 75%, #2a2f3d 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

function useHtmlImage(src: string | undefined | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src?.trim()) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setImage(null);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return image;
}

function ImageNode({
  obj,
  draggable,
  onSelect,
  onChange,
}: {
  obj: Extract<
    CanvasObject,
    { type: "background" | "subject" | "sticker" | "photo" }
  >;
  draggable: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasObject>) => void;
}) {
  const image = useHtmlImage(obj.src);
  return (
    <KonvaImage
      id={obj.id}
      image={image || undefined}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation}
      scaleX={obj.scaleX}
      scaleY={obj.scaleY}
      opacity={obj.opacity}
      visible={obj.visible}
      draggable={draggable && !obj.locked}
      listening={!obj.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({ x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={(e) => {
        const node = e.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        onChange({
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(8, node.width() * scaleX),
          height: Math.max(8, node.height() * scaleY),
          scaleX: 1,
          scaleY: 1,
        });
        node.scaleX(1);
        node.scaleY(1);
      }}
    />
  );
}

function TextNode({
  obj,
  onSelect,
  onChange,
  onEdit,
}: {
  obj: CanvasTextObject;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasObject>) => void;
  onEdit: () => void;
}) {
  // Keep emoji / special symbols on the same fontSize as Hangul/Latin.
  const fontFamily = /emoji/i.test(obj.fontFamily)
    ? obj.fontFamily
    : `${obj.fontFamily}, ${EMOJI_FONT}`;
  const fontSize = Math.max(8, Math.round(obj.fontSize || 48));

  return (
    <Text
      id={obj.id}
      text={obj.text || " "}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation}
      scaleX={obj.scaleX}
      scaleY={obj.scaleY}
      opacity={obj.opacity}
      visible={obj.visible}
      fontSize={fontSize}
      fontFamily={fontFamily}
      fontStyle={obj.fontWeight >= 600 ? "bold" : "normal"}
      fill={obj.fill}
      align={obj.align}
      verticalAlign="middle"
      lineHeight={obj.lineHeight}
      letterSpacing={obj.letterSpacing}
      wrap="word"
      draggable={!obj.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onEdit}
      onDblTap={onEdit}
      onDragEnd={(e) => {
        onChange({ x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Text;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const nextW = Math.max(40, node.width() * scaleX);
        const nextH = Math.max(24, node.height() * scaleY);
        // Scale font with box height for responsive typography.
        const nextFont = Math.max(
          10,
          Math.round(fontSize * ((scaleX + scaleY) / 2))
        );
        onChange({
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: nextW,
          height: nextH,
          fontSize: nextFont,
          scaleX: 1,
          scaleY: 1,
        });
        node.scaleX(1);
        node.scaleY(1);
      }}
    />
  );
}

export type StudioKonvaStageProps = {
  width: number;
  height: number;
  className?: string;
  /** Called when text content edited via inline editor */
  onTextContentChange?: (id: string, text: string) => void;
  /** Called when text transform implies font size change */
  onTextStyleChange?: (
    id: string,
    patch: { fontSize?: number; align?: CanvasTextObject["align"] }
  ) => void;
};

export type StudioKonvaStageHandle = {
  exportDataUrl: (pixelRatio?: number) => string | null;
  getStage: () => Konva.Stage | null;
};

export const StudioKonvaStage = forwardRef<
  StudioKonvaStageHandle,
  StudioKonvaStageProps
>(function StudioKonvaStage(
  { width, height, className, onTextContentChange, onTextStyleChange },
  ref
) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const objects = useCanvasStore((s) => s.objects);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const editingTextId = useCanvasStore((s) => s.editingTextId);
  const select = useCanvasStore((s) => s.select);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const setEditingTextId = useCanvasStore((s) => s.setEditingTextId);

  const ordered = useMemo(() => sortByZIndex(objects), [objects]);

  useImperativeHandle(ref, () => ({
    exportDataUrl: (pixelRatio = 2) => {
      const stage = stageRef.current;
      if (!stage) return null;
      // Hide transformer for clean export
      const tr = trRef.current;
      const prevVisible = tr?.visible();
      tr?.visible(false);
      const url = stage.toDataURL({
        pixelRatio: Math.max(1, Math.min(4, pixelRatio)),
        mimeType: "image/png",
      });
      if (tr && prevVisible !== undefined) tr.visible(prevVisible);
      return url;
    },
    getStage: () => stageRef.current,
  }));

  // Attach transformer to selected node
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne((n: Konva.Node) => n.id() === selectedId);
    if (!node || node.getAttr("locked")) {
      tr.nodes([]);
    } else {
      tr.nodes([node]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, ordered]);

  const onTransformStart = useCallback(() => {
    const tr = trRef.current;
    if (!tr) return;
    const anchor = tr.getActiveAnchor();
    const isCorner = Boolean(
      anchor &&
        ["top-left", "top-right", "bottom-left", "bottom-right"].includes(anchor)
    );
    // Corners → aspect lock; edge handles → free transform (Canva-like).
    tr.keepRatio(isCorner);
  }, []);

  const patchObject = useCallback(
    (id: string, patch: Partial<CanvasObject>) => {
      updateObject(id, patch);
      if (
        "fontSize" in patch &&
        typeof patch.fontSize === "number" &&
        onTextStyleChange
      ) {
        onTextStyleChange(id, { fontSize: patch.fontSize });
      }
    },
    [onTextStyleChange, updateObject]
  );

  const editingObj = ordered.find(
    (o): o is CanvasTextObject => o.id === editingTextId && o.type === "text"
  );

  if (width < 8 || height < 8) {
    return (
      <div
        className={className}
        style={{ ...CHECKER, width: "100%", height: "100%" }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{ ...CHECKER, width, height, position: "relative" }}
    >
      <Stage
        ref={(node) => {
          stageRef.current = node;
        }}
        width={width}
        height={height}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            clearSelection();
            setEditingTextId(null);
          }
        }}
        onTouchStart={(e) => {
          if (e.target === e.target.getStage()) {
            clearSelection();
            setEditingTextId(null);
          }
        }}
      >
        <Layer>
          {/* Transparent hit area so empty clicks clear selection */}
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="rgba(0,0,0,0)"
            listening={false}
          />
          {ordered.map((obj) => {
            if (!obj.visible) return null;
            if (obj.type === "text") {
              return (
                <TextNode
                  key={obj.id}
                  obj={obj}
                  onSelect={() => select(obj.id)}
                  onChange={(patch) => patchObject(obj.id, patch)}
                  onEdit={() => setEditingTextId(obj.id)}
                />
              );
            }
            return (
              <ImageNode
                key={obj.id}
                obj={obj}
                draggable={!obj.locked}
                onSelect={() => select(obj.id)}
                onChange={(patch) => patchObject(obj.id, patch)}
              />
            );
          })}
          <Transformer
            ref={(node) => {
              trRef.current = node;
            }}
            rotateEnabled
            enabledAnchors={[
              "top-left",
              "top-center",
              "top-right",
              "middle-left",
              "middle-right",
              "bottom-left",
              "bottom-center",
              "bottom-right",
            ]}
            borderDash={[6, 4]}
            borderStroke="#6366f1"
            anchorStroke="#6366f1"
            anchorFill="#ffffff"
            anchorSize={10}
            rotateAnchorOffset={24}
            onTransformStart={onTransformStart}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 12 || newBox.height < 12) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>

      {editingObj ? (
        <textarea
          autoFocus
          value={editingObj.text}
          onChange={(e) => {
            const text = e.target.value;
            updateObject(editingObj.id, { text });
            onTextContentChange?.(editingObj.id, text);
          }}
          onBlur={() => setEditingTextId(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditingTextId(null);
          }}
          className="absolute z-20 resize-none rounded-md border border-indigo-400/60 bg-black/80 px-2 py-1 text-sm text-white outline-none shadow-lg"
          style={{
            left: Math.max(0, editingObj.x),
            top: Math.max(0, editingObj.y),
            width: Math.max(80, editingObj.width * editingObj.scaleX),
            height: Math.max(36, editingObj.height * editingObj.scaleY),
            fontSize: editingObj.fontSize,
            fontFamily: editingObj.fontFamily,
            fontWeight: editingObj.fontWeight,
            color: editingObj.fill,
            textAlign: editingObj.align,
            lineHeight: editingObj.lineHeight,
          }}
        />
      ) : null}
    </div>
  );
});

export default StudioKonvaStage;
