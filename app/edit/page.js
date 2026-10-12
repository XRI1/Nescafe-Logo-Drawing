"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowClockwise,
  CheckCircle,
  Eraser,
  PaintBucket,
  PaintBrush,
  PaperPlaneTilt,
  PenNib,
  PencilSimple,
  Trash,
  X
} from "@phosphor-icons/react";
import { IoIosColorPalette } from "react-icons/io";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const W = 760;
const H = 560;
const LEAF_SIZE = 560;
const LEAF_X = (W - LEAF_SIZE) / 2;
const STICKERS = [
  { src: "/assets/sticker-love.png", label: "Love" },
  { src: "/assets/sticker-secret.png", label: "Secret" },
  { src: "/assets/sticker-dance.png", label: "Dance" },
  { src: "/assets/sticker-snack.png", label: "Snack" }
];
const INK_COLORS = ["#ed1c2e", "#ffca28", "#52d19b", "#72b7ff", "#ffffff", "#140508"];
const LEAF_COLORS = ["#ffffff", "#f5ebdf", "#ebd5bf", "#fce2db", "#e2ece9", "#dae8f5", "#a21f25", "#5b1317", "#241215", "#1e3a5f"];
const EDITOR_COLOR = "#a21f25";

const luminance = (hex) => {
  const rgb = hex.replace("#", "").match(/.{2}/g).map((value) => parseInt(value, 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};

const contrast = (a, b) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

const controlColors = (leafColor) => {
  const candidates = ["#ffffff", "#111111", "#00e5ff", "#ffe600", "#74ff70"];
  const outline = candidates.reduce((best, color) => Math.min(contrast(color, leafColor), contrast(color, EDITOR_COLOR)) > Math.min(contrast(best, leafColor), contrast(best, EDITOR_COLOR)) ? color : best);
  return { outline, ink: contrast(outline, "#111111") > contrast(outline, "#ffffff") ? "#111111" : "#ffffff" };
};

function DrawingCanvas({ canvasRef, color, tool, size, onHistory }) {
  const drawing = useRef(false);
  const last = useRef(null);

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * W) / rect.width,
      y: ((event.clientY - rect.top) * H) / rect.height
    };
  };

  const draw = (event) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const p = point(event);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = size;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
    last.current = p;
  };

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      aria-label="Drawing canvas inside NESCAFÉ leaf"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        last.current = point(e);
      }}
      onPointerMove={draw}
      onPointerUp={() => {
        if (drawing.current) {
          drawing.current = false;
          onHistory();
        }
      }}
      onPointerCancel={() => {
        drawing.current = false;
      }}
    />
  );
}

export default function EditPage() {
  const router = useRouter();
  const canvasRef = useRef(null);
  const canvasShellRef = useRef(null);
  const leafRef = useRef(null);
  const outlineRef = useRef(null);
  const history = useRef([]);
  const [color, setColor] = useState(INK_COLORS[0]);
  const [leafColor, setLeafColor] = useState("#ffffff");
  const [tool, setTool] = useState("pen");
  const [size, setSize] = useState(18);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sentMessage, setSentMessage] = useState(false);
  const [placedStickers, setPlacedStickers] = useState([]);
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const trayDragRef = useRef(null);
  const stickerGestureRef = useRef({ id: null, pointers: new Map(), lastX: 0, lastY: 0, startDistance: 0, startWidth: 0 });
  const transformHandleRef = useRef(null);

  const inkInputRef = useRef(null);
  const leafInputRef = useRef(null);

  const openInkPicker = () => {
    if (inkInputRef.current) {
      if (typeof inkInputRef.current.showPicker === "function") {
        try {
          inkInputRef.current.showPicker();
        } catch {
          inkInputRef.current.click();
        }
      } else {
        inkInputRef.current.click();
      }
    }
  };

  const openLeafPicker = () => {
    if (leafInputRef.current) {
      if (typeof leafInputRef.current.showPicker === "function") {
        try {
          leafInputRef.current.showPicker();
        } catch {
          leafInputRef.current.click();
        }
      } else {
        leafInputRef.current.click();
      }
    }
  };

  const snapshot = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    history.current = [...history.current.slice(-19), c.toDataURL()];
  }, []);

  useEffect(() => {
    snapshot();
  }, [snapshot]);

  const restore = (url) => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0);
    };
    img.src = url;
  };

  const undo = () => {
    if (history.current.length <= 1) return;
    history.current.pop();
    restore(history.current.at(-1));
  };

  const clear = () => {
    canvasRef.current.getContext("2d").clearRect(0, 0, W, H);
    setPlacedStickers([]);
    setSelectedStickerId(null);
    snapshot();
  };

  const addSticker = (sticker, x, y) => {
    setPlacedStickers((items) => [...items, {
      id: crypto.randomUUID(), src: sticker.src, label: sticker.label,
      x, y, w: 112, h: 138, rotation: 0
    }]);
  };

  const dropSticker = (sticker, point) => {
    const shell = canvasShellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    if (point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) return;
    addSticker(sticker, ((point.x - rect.left) * W) / rect.width, ((point.y - rect.top) * H) / rect.height);
  };

  const startTrayDrag = (sticker, event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    trayDragRef.current = sticker;
    setDragPreview({ sticker, x: event.clientX, y: event.clientY });
  };

  const moveTrayDrag = (event) => {
    if (!trayDragRef.current) return;
    setDragPreview({ sticker: trayDragRef.current, x: event.clientX, y: event.clientY });
  };

  const endTrayDrag = (event) => {
    if (!trayDragRef.current) return;
    dropSticker(trayDragRef.current, { x: event.clientX, y: event.clientY });
    trayDragRef.current = null;
    setDragPreview(null);
  };

  const startPlacedDrag = (id, event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedStickerId(id);
    const gesture = stickerGestureRef.current;
    if (gesture.id !== id) gesture.pointers.clear();
    gesture.id = id;
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gesture.pointers.size === 1) {
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
    } else if (gesture.pointers.size === 2) {
      const [a, b] = [...gesture.pointers.values()];
      gesture.startDistance = Math.hypot(b.x - a.x, b.y - a.y);
      gesture.startWidth = placedStickers.find((item) => item.id === id)?.w || 112;
    }
  };

  const movePlacedDrag = (event) => {
    const active = stickerGestureRef.current;
    const shell = canvasShellRef.current;
    if (!active.id || !active.pointers.has(event.pointerId) || !shell) return;
    active.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = shell.getBoundingClientRect();
    if (active.pointers.size >= 2) {
      const [a, b] = [...active.pointers.values()];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const nextWidth = Math.max(55, Math.min(230, active.startWidth * (distance / Math.max(1, active.startDistance))));
      setPlacedStickers((items) => items.map((item) => item.id === active.id ? { ...item, w: nextWidth, h: nextWidth * 1.23 } : item));
    } else {
      const dx = ((event.clientX - active.lastX) * W) / rect.width;
      const dy = ((event.clientY - active.lastY) * H) / rect.height;
      active.lastX = event.clientX;
      active.lastY = event.clientY;
      setPlacedStickers((items) => items.map((item) => item.id === active.id ? {
        ...item,
        x: Math.max(LEAF_X, Math.min(W - LEAF_X, item.x + dx)),
        y: Math.max(0, Math.min(H, item.y + dy))
      } : item));
    }
  };

  const endPlacedDrag = (event) => {
    const gesture = stickerGestureRef.current;
    gesture.pointers.delete(event.pointerId);
    if (gesture.pointers.size === 1) {
      const remaining = [...gesture.pointers.values()][0];
      gesture.lastX = remaining.x;
      gesture.lastY = remaining.y;
    } else if (gesture.pointers.size === 0) {
      gesture.id = null;
    }
  };

  const stickerCenterOnScreen = (item) => {
    const rect = canvasShellRef.current.getBoundingClientRect();
    return { x: rect.left + (item.x / W) * rect.width, y: rect.top + (item.y / H) * rect.height };
  };

  const startResizeHandle = (item, event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const center = stickerCenterOnScreen(item);
    transformHandleRef.current = { type: "resize", id: item.id, center, startWidth: item.w, startDistance: Math.max(1, Math.hypot(event.clientX - center.x, event.clientY - center.y)) };
  };

  const startRotateHandle = (item, event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const center = stickerCenterOnScreen(item);
    transformHandleRef.current = { type: "rotate", id: item.id, center, startRotation: item.rotation, startAngle: Math.atan2(event.clientY - center.y, event.clientX - center.x) };
  };

  const moveTransformHandle = (event) => {
    const active = transformHandleRef.current;
    if (!active) return;
    if (active.type === "resize") {
      const distance = Math.hypot(event.clientX - active.center.x, event.clientY - active.center.y);
      const width = Math.max(55, Math.min(230, active.startWidth * (distance / active.startDistance)));
      setPlacedStickers((items) => items.map((item) => item.id === active.id ? { ...item, w: width, h: width * 1.23 } : item));
    } else {
      const angle = Math.atan2(event.clientY - active.center.y, event.clientX - active.center.x);
      const rotation = active.startRotation + ((angle - active.startAngle) * 180) / Math.PI;
      setPlacedStickers((items) => items.map((item) => item.id === active.id ? { ...item, rotation } : item));
    }
  };

  const endTransformHandle = () => {
    transformHandleRef.current = null;
  };

  const loadStickerImage = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const clean = document.createElement("canvas");
      clean.width = img.width;
      clean.height = img.height;
      const ctx = clean.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, clean.width, clean.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i] > 245 && pixels.data[i + 1] > 245 && pixels.data[i + 2] > 245) pixels.data[i + 3] = 0;
      }
      ctx.putImageData(pixels, 0, 0);
      resolve(clean);
    };
    img.src = src;
  });

  const createSavedDesign = async () => {
    const mask = leafRef.current;
    const strokes = document.createElement("canvas");
    strokes.width = W;
    strokes.height = H;
    const strokesCtx = strokes.getContext("2d");
    strokesCtx.drawImage(canvasRef.current, 0, 0);
    strokesCtx.globalCompositeOperation = "destination-in";
    strokesCtx.drawImage(mask, LEAF_X, 0, LEAF_SIZE, LEAF_SIZE);

    const output = document.createElement("canvas");
    output.width = W;
    output.height = H;
    const outputCtx = output.getContext("2d");
    outputCtx.fillStyle = leafColor;
    outputCtx.fillRect(0, 0, W, H);
    outputCtx.globalCompositeOperation = "destination-in";
    outputCtx.drawImage(mask, LEAF_X, 0, LEAF_SIZE, LEAF_SIZE);
    outputCtx.globalCompositeOperation = "source-over";
    outputCtx.drawImage(strokes, 0, 0);
    const stickerImages = await Promise.all(placedStickers.map((item) => loadStickerImage(item.src)));
    placedStickers.forEach((item, index) => {
      outputCtx.save();
      outputCtx.translate(item.x, item.y);
      outputCtx.rotate((item.rotation * Math.PI) / 180);
      outputCtx.drawImage(stickerImages[index], -item.w / 2, -item.h / 2, item.w, item.h);
      outputCtx.restore();
    });
    outputCtx.globalCompositeOperation = "destination-in";
    outputCtx.drawImage(mask, LEAF_X, 0, LEAF_SIZE, LEAF_SIZE);
    outputCtx.globalCompositeOperation = "source-over";
    return output.toDataURL("image/png");
  };

  const handleOpenConfirm = () => {
    if (sending || sentMessage) return;
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirm(false);
    setSending(true);
    try {
      const image = await createSavedDesign();
      const blob = await fetch(image).then((response) => response.blob());
      const formData = new FormData();
      formData.append("image", blob, `nescafe-${Date.now()}.png`);
      const response = await fetch("/api/designs", {
        method: "POST",
        body: formData
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send your design");
      setSentMessage(true);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      window.alert(error.message || "Unable to send your design. Please try again.");
      setSending(false);
    }
  };

  const selectedSticker = placedStickers.find((item) => item.id === selectedStickerId);
  const transformColors = controlColors(leafColor);

  return (
    <motion.main
      className="editor screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="editor-head">
        <div className="editor-ribbon">
          <button className="nav-back" onClick={() => router.push("/")} aria-label="Back to home page">
            <ArrowLeft /> <span>BACK</span>
          </button>
          <strong>LET&apos;S MAKE YOUR WORLD</strong>
          <img src="/assets/nescafe-logo-trimmed.png" alt="NESCAFÉ — Make your world" />
        </div>
      </header>

      <section className="editor-grid">
        <aside className="toolbox">
          <span className="vertical-label">DRAW TOOLS</span>
          <button className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")} aria-label="Pen">
            <PencilSimple />
          </button>
          <button className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")} aria-label="Eraser">
            <Eraser />
          </button>
          <button onClick={undo} aria-label="Undo">
            <ArrowCounterClockwise />
          </button>
          <button onClick={clear} aria-label="Clear">
            <Trash />
          </button>
        </aside>

        <div className="studio">
          <div ref={canvasShellRef} className="canvas-shell" onPointerDownCapture={(event) => {if(event.target.tagName === "CANVAS") setSelectedStickerId(null)}}>
            <img ref={leafRef} className="leaf-mask-source" src="/assets/nescafe-leaf.png" alt="" />
            <div className="leaf-image" style={{ backgroundColor: leafColor }} role="img" aria-label="NESCAFÉ leaf drawing canvas" />
            <DrawingCanvas canvasRef={canvasRef} color={color} tool={tool} size={size} onHistory={snapshot} />
            <div className="placed-stickers" style={{ "--selection-color": transformColors.outline, "--selection-ink": transformColors.ink }}>
              {placedStickers.map((sticker) => (
                <div
                  key={sticker.id}
                  className={`placed-sticker${selectedStickerId === sticker.id ? " selected" : ""}`}
                  onPointerDown={(event) => startPlacedDrag(sticker.id, event)}
                  onPointerMove={movePlacedDrag}
                  onPointerUp={endPlacedDrag}
                  onPointerCancel={endPlacedDrag}
                  style={{ left: `${(sticker.x / W) * 100}%`, top: `${(sticker.y / H) * 100}%`, width: `${(sticker.w / W) * 100}%`, height: `${(sticker.h / H) * 100}%`, transform: `translate(-50%,-50%) rotate(${sticker.rotation}deg)` }}
                >
                  <img src={sticker.src} alt={sticker.label} />
                  {selectedStickerId === sticker.id && (
                    <>
                      {['nw','ne','sw','se'].map((corner) => <button key={corner} className={`transform-handle resize-handle ${corner}`} onPointerDown={(event)=>startResizeHandle(sticker,event)} onPointerMove={moveTransformHandle} onPointerUp={endTransformHandle} onPointerCancel={endTransformHandle} aria-label="Resize doodle" />)}
                      <span className="rotate-stem" />
                      <button className="transform-handle rotate-handle" onPointerDown={(event)=>startRotateHandle(sticker,event)} onPointerMove={moveTransformHandle} onPointerUp={endTransformHandle} onPointerCancel={endTransformHandle} aria-label="Rotate doodle"><ArrowClockwise weight="bold" /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <img ref={outlineRef} className="leaf-dotted-outline" src="/assets/leaf-outline.svg" alt="" aria-hidden="true" />
            <span className="canvas-hint">YOUR WORLD STARTS HERE</span>
          </div>
        </div>

        <aside className="stickers">
          <span>DROP A DOODLE</span>
          <div>
            {STICKERS.map((s) => (
              <motion.button
                key={s.src}
                onPointerDown={(event) => startTrayDrag(s, event)}
                onPointerMove={moveTrayDrag}
                onPointerUp={endTrayDrag}
                onPointerCancel={endTrayDrag}
                whileHover={{ scale: 1.06, rotate: -2 }}
                aria-label={`Drag ${s.label} onto the leaf`}
              >
                <img src={s.src} alt={s.label} />
              </motion.button>
            ))}
          </div>
        </aside>
      </section>

      {dragPreview && (
        <div className="sticker-drag-preview" style={{ left: dragPreview.x, top: dragPreview.y }}>
          <img src={dragPreview.sticker.src} alt="" />
        </div>
      )}

      {/* Bottom Controls Bar with Both Color Sections */}
      <div className="editor-controls-bar">
        {/* Left Section: Pen Ink Color Palette & Stroke */}
        <div className="control-dock ink-stroke-dock">
          {/* Ink color section */}
          <div className="ink-side-column">
            <div className="dock-color-section">
              {/* Pill with Palette icon and Current Color dot */}
              <div className="color-plate-pill">
                <button
                  type="button"
                  className="palette-btn-icon"
                  onClick={openInkPicker}
                  title="Choose custom ink color"
                  aria-label="Open color plate to choose ink color"
                >
                  <IoIosColorPalette size={22} className="palette-logo-icon" />
                </button>

                {/* Hidden native color input */}
                <input
                  ref={inkInputRef}
                  type="color"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    setTool("pen");
                  }}
                  className="native-color-input-hidden"
                  aria-hidden="true"
                />

                {/* Current color dot (Display only, not clickable) */}
                <span
                  className="active-color-dot"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
              </div>

              {/* Auto-visible ink color swatches */}
              <div className="swatch-group auto-visible-swatches">
                {INK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setTool("pen");
                    }}
                    className={color === c ? "swatch selected" : "swatch"}
                    style={{ background: c }}
                    aria-label={`Use ink color ${c}`}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Ink text and pen icon placed below the ink color section */}
            <div className="dock-sub-label">
              <PenNib size={12} weight="fill" className="sub-icon" />
              <span>INK</span>
            </div>
          </div>

          <div className="dock-divider" />

          {/* Stroke section moved to INK side */}
          <div className="stroke-side-column">
            <div className="stroke-control-wrap">
              <label className="stroke-slider" title="Adjust stroke size">
                <input
                  type="range"
                  min="4"
                  max="42"
                  value={size}
                  onChange={(e) => setSize(+e.target.value)}
                />
                <b style={{ width: Math.max(5, size / 1.7), height: Math.max(5, size / 1.7) }} />
              </label>
            </div>
            <div className="dock-sub-label stroke-sub-label">
              <PaintBrush size={12} weight="fill" className="sub-icon" />
              <span>STROKE</span>
            </div>
          </div>
        </div>

        {/* Right Section: Logo Background Color */}
        <div className="control-dock logo-dock">
          <div className="logo-side-column">
            <div className="dock-color-section">
              {/* Logo Pill with same Palette Button and Current Logo Color dot */}
              <div className="color-plate-pill">
                <button
                  type="button"
                  className="palette-btn-icon"
                  onClick={openLeafPicker}
                  title="Choose custom logo color"
                  aria-label="Open color plate to choose logo color"
                >
                  <IoIosColorPalette size={22} className="palette-logo-icon" />
                </button>

                {/* Hidden native color input */}
                <input
                  ref={leafInputRef}
                  type="color"
                  value={leafColor}
                  onChange={(e) => setLeafColor(e.target.value)}
                  className="native-color-input-hidden"
                  aria-hidden="true"
                />

                {/* Current logo color dot (Display only, not clickable) */}
                <span
                  className="active-color-dot"
                  style={{ backgroundColor: leafColor }}
                  aria-hidden="true"
                />
              </div>

              {/* Auto-visible logo color swatches */}
              <div className="swatch-group auto-visible-swatches">
                {LEAF_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setLeafColor(c)}
                    className={leafColor === c ? "swatch selected" : "swatch"}
                    style={{ background: c }}
                    aria-label={`Use logo color ${c}`}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Replaced icons with "LOGO" text */}
            <div className="dock-sub-label" title="Logo canvas background">
              <span>LOGO</span>
            </div>
          </div>
        </div>
      </div>

      <button
        className="send-btn"
        onClick={handleOpenConfirm}
        disabled={sending || sentMessage}
      >
        <span>
          {sending ? "LAUNCHING..." : sentMessage ? "LAUNCHED!" : "SEND TO THE WORLD"}
        </span>
        <PaperPlaneTilt weight="fill" />
      </button>

      {/* NESCAFÉ Themed Confirm & Success Modals */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !sending && setShowConfirm(false)}
          >
            <motion.div
              className="nescafe-modal"
              initial={{ scale: 0.9, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 340, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowConfirm(false)}
                aria-label="Close dialog"
              >
                <X size={15} />
              </button>

              <h3 className="modal-title-pacifico">Make Your World</h3>
              <p className="modal-subtitle">
                Ready to send your creation into the world? It will take flight across the Earth globe for everyone to see.
              </p>

              <div className="nescafe-modal-actions">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setShowConfirm(false)}
                >
                  KEEP EDITING
                </button>
                <button
                  type="button"
                  className="modal-btn-confirm"
                  onClick={handleConfirmSend}
                >
                  <span>SEND NOW</span>
                  <PaperPlaneTilt weight="fill" size={15} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {sentMessage && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="nescafe-modal"
              initial={{ scale: 0.88, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 24 }}
            >
              <h3 className="modal-title-pacifico">Flown to the World!</h3>
              <p className="modal-subtitle">
                Your design is now orbiting high above the Earth. Preparing a fresh canvas...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
