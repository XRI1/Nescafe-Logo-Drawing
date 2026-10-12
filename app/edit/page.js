"use client";

import { motion } from "framer-motion";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  Eraser,
  PaintBucket,
  PaintBrush,
  PaperPlaneTilt,
  PencilSimple,
  Trash
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
const INK_COLORS = ["#ed1c2e", "#ff8c00", "#ffca28", "#52d19b", "#00bcd4", "#72b7ff", "#7047eb", "#ff78ad", "#ffffff", "#140508"];
const LEAF_COLORS = ["#ffffff", "#f5ebdf", "#a21f25", "#241215", "#1e3a5f"];

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
  const leafRef = useRef(null);
  const history = useRef([]);
  const [color, setColor] = useState(INK_COLORS[0]);
  const [leafColor, setLeafColor] = useState("#ffffff");
  const [tool, setTool] = useState("pen");
  const [size, setSize] = useState(18);
  const [sending, setSending] = useState(false);

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
    snapshot();
  };

  const addSticker = (sticker) => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current.getContext("2d");
      const off = document.createElement("canvas");
      off.width = img.width;
      off.height = img.height;
      const ox = off.getContext("2d", { willReadFrequently: true });
      ox.drawImage(img, 0, 0);
      const data = ox.getImageData(0, 0, off.width, off.height);
      for (let i = 0; i < data.data.length; i += 4) {
        if (data.data[i] > 245 && data.data[i + 1] > 245 && data.data[i + 2] > 245) {
          data.data[i + 3] = 0;
        }
      }
      ox.putImageData(data, 0, 0);
      const ratio = img.width / img.height;
      const h = 150;
      ctx.drawImage(off, 355 - (h * ratio) / 2, 205, h * ratio, h);
      snapshot();
    };
    img.src = sticker.src;
  };

  const createSavedDesign = () => {
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
    return output.toDataURL("image/png");
  };

  const send = async () => {
    setSending(true);
    const image = createSavedDesign();
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("nescafe-design", image);
      }
      await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image })
      });
      await new Promise((r) => setTimeout(r, 600));
      router.push("/nescafe");
    } catch {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("nescafe-design", image);
      }
      router.push("/nescafe");
    } finally {
      setSending(false);
    }
  };

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
          <div className="canvas-shell">
            <img ref={leafRef} className="leaf-mask-source" src="/assets/nescafe-leaf.png" alt="" />
            <div className="leaf-image" style={{ backgroundColor: leafColor }} role="img" aria-label="NESCAFÉ leaf drawing canvas" />
            <DrawingCanvas canvasRef={canvasRef} color={color} tool={tool} size={size} onHistory={snapshot} />
            <span className="canvas-hint">YOUR WORLD STARTS HERE</span>
          </div>
        </div>

        <aside className="stickers">
          <span>DROP A DOODLE</span>
          <div>
            {STICKERS.map((s) => (
              <motion.button whileHover={{ scale: 1.06, rotate: -2 }} whileTap={{ scale: 0.92 }} key={s.src} onClick={() => addSticker(s)}>
                <img src={s.src} alt={s.label} />
                <b>+</b>
              </motion.button>
            ))}
          </div>
        </aside>
      </section>

      {/* Bottom Controls Bar with Both Color Sections */}
      <div className="editor-controls-bar">
        {/* Left Section: Pen Ink Color Palette */}
        <div className="control-dock ink-dock">
          <div className="dock-badge">
            <IoIosColorPalette size={21} className="dock-icon" />
            <span>INK</span>
          </div>
          <label className="color-picker-btn" title="Choose custom ink color">
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setTool("pen");
              }}
            />
            <span className="picker-swatch" style={{ background: color }} />
          </label>
          <div className="swatch-group">
            {INK_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setTool("pen");
                }}
                className={color === c ? "swatch selected" : "swatch"}
                style={{ background: c }}
                aria-label={`Use ink color ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Right Section: Leaf Background Color & Stroke */}
        <div className="control-dock leaf-stroke-dock">
          <div className="leaf-section">
            <div className="dock-badge">
              <PaintBucket size={19} weight="fill" className="dock-icon" />
              <span>LEAF</span>
            </div>
            <label className="color-picker-btn" title="Choose custom leaf background color">
              <input type="color" value={leafColor} onChange={(e) => setLeafColor(e.target.value)} />
              <span className="picker-swatch" style={{ background: leafColor }} />
            </label>
            <div className="swatch-group">
              {LEAF_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setLeafColor(c)}
                  className={leafColor === c ? "swatch selected" : "swatch"}
                  style={{ background: c }}
                  aria-label={`Use leaf color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="dock-divider" />

          <div className="stroke-section">
            <div className="dock-badge" title="Stroke size">
              <PaintBrush size={18} weight="fill" className="dock-icon" />
            </div>
            <label className="stroke-slider" title="Adjust stroke size">
              <input type="range" min="4" max="42" value={size} onChange={(e) => setSize(+e.target.value)} />
              <b style={{ width: Math.max(5, size / 1.7), height: Math.max(5, size / 1.7) }} />
            </label>
          </div>
        </div>
      </div>

      <button className="send-btn" onClick={send} disabled={sending}>
        <span>{sending ? "LAUNCHING..." : "SEND TO THE WORLD"}</span>
        <PaperPlaneTilt weight="fill" />
      </button>
    </motion.main>
  );
}
