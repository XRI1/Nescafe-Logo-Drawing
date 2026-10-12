"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowCounterClockwise, ArrowLeft, ArrowRight, Check, Eraser, PaintBucket, PaintBrush, PaperPlaneTilt, PencilSimple, Trash } from "@phosphor-icons/react";
import { IoIosColorPalette } from "react-icons/io";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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

function Brand({ compact = false }) {
  return <img className={compact ? "brand brand--compact" : "brand"} src="/assets/nescafe-logo.png" alt="NESCAFÉ — Make your world" />;
}

function Landing({ onStart }) {
  return (
    <motion.main className="landing landing-simple screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: .55 }}>
      <motion.img className="landing-earth" src="/assets/earth.jpg" alt="Earth glowing beneath the stars" initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} />
      <motion.div className="landing-center" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35, duration: .8 }}>
        <img className="landing-logo" src="/assets/nescafe-logo.png" alt="NESCAFÉ — Make your world" />
        <motion.button className="start-btn landing-start" onClick={onStart} whileHover={{ scale: 1.05 }} whileTap={{ scale: .95 }}>
          <span>START</span>
        </motion.button>
      </motion.div>
    </motion.main>
  );
}

function DrawingCanvas({ canvasRef, color, tool, size, onHistory }) {
  const drawing = useRef(false);
  const last = useRef(null);

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x:(event.clientX-rect.left)*W/rect.width, y:(event.clientY-rect.top)*H/rect.height };
  };
  const draw = (event) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const p = point(event);
    ctx.save(); ctx.lineCap="round"; ctx.lineJoin="round"; ctx.lineWidth=size;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle=color; ctx.beginPath(); ctx.moveTo(last.current.x,last.current.y); ctx.lineTo(p.x,p.y); ctx.stroke(); ctx.restore(); last.current=p;
  };
  return <canvas ref={canvasRef} width={W} height={H} aria-label="Drawing canvas inside NESCAFÉ leaf" onPointerDown={(e)=>{e.currentTarget.setPointerCapture(e.pointerId);drawing.current=true;last.current=point(e);}} onPointerMove={draw} onPointerUp={()=>{if(drawing.current){drawing.current=false;onHistory();}}} onPointerCancel={()=>drawing.current=false}/>;
}

function Editor({ onSend, onBack }) {
  const canvasRef = useRef(null);
  const leafRef = useRef(null);
  const history = useRef([]);
  const [color,setColor]=useState(INK_COLORS[0]);
  const [leafColor,setLeafColor]=useState("#ffffff");
  const [tool,setTool]=useState("pen");
  const [size,setSize]=useState(18);
  const [sending,setSending]=useState(false);

  const snapshot=useCallback(()=>{const c=canvasRef.current;if(!c)return;history.current=[...history.current.slice(-19),c.toDataURL()];},[]);
  useEffect(()=>{snapshot();},[snapshot]);
  const restore=(url)=>{const img=new Image();img.onload=()=>{const ctx=canvasRef.current.getContext("2d");ctx.clearRect(0,0,W,H);ctx.drawImage(img,0,0)};img.src=url;};
  const undo=()=>{if(history.current.length<=1)return;history.current.pop();restore(history.current.at(-1));};
  const clear=()=>{canvasRef.current.getContext("2d").clearRect(0,0,W,H);snapshot();};
  const addSticker=(sticker)=>{const img=new Image();img.onload=()=>{const ctx=canvasRef.current.getContext("2d");const off=document.createElement("canvas");off.width=img.width;off.height=img.height;const ox=off.getContext("2d",{willReadFrequently:true});ox.drawImage(img,0,0);const data=ox.getImageData(0,0,off.width,off.height);for(let i=0;i<data.data.length;i+=4){if(data.data[i]>245&&data.data[i+1]>245&&data.data[i+2]>245)data.data[i+3]=0;}ox.putImageData(data,0,0);const ratio=img.width/img.height;const h=150;ctx.drawImage(off,355-h*ratio/2,205,h*ratio,h);snapshot();};img.src=sticker.src;};
  const createSavedDesign=()=>{const mask=leafRef.current;const strokes=document.createElement("canvas");strokes.width=W;strokes.height=H;const strokesCtx=strokes.getContext("2d");strokesCtx.drawImage(canvasRef.current,0,0);strokesCtx.globalCompositeOperation="destination-in";strokesCtx.drawImage(mask,LEAF_X,0,LEAF_SIZE,LEAF_SIZE);const output=document.createElement("canvas");output.width=W;output.height=H;const outputCtx=output.getContext("2d");outputCtx.fillStyle=leafColor;outputCtx.fillRect(0,0,W,H);outputCtx.globalCompositeOperation="destination-in";outputCtx.drawImage(mask,LEAF_X,0,LEAF_SIZE,LEAF_SIZE);outputCtx.globalCompositeOperation="source-over";outputCtx.drawImage(strokes,0,0);return output.toDataURL("image/png");};
  const send=async()=>{setSending(true);const image=createSavedDesign();try{const res=await fetch("/api/designs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image})});if(!res.ok)throw new Error();await new Promise(r=>setTimeout(r,700));onSend(image);}catch{setSending(false);alert("Could not save your world. Please try again.");}};

  return (
    <motion.main className="editor screen" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <header className="editor-head">
        <div className="editor-ribbon">
          <button className="nav-back" onClick={onBack} aria-label="Back to landing page"><ArrowLeft/> <span>BACK</span></button>
          <strong>LET&apos;S MAKE YOUR WORLD</strong>
          <img src="/assets/nescafe-logo-trimmed.png" alt="NESCAFÉ — Make your world" />
        </div>
      </header>
      <section className="editor-grid">
        <aside className="toolbox">
          <span className="vertical-label">DRAW TOOLS</span>
          <button className={tool==="pen"?"active":""} onClick={()=>setTool("pen")} aria-label="Pen"><PencilSimple/></button>
          <button className={tool==="eraser"?"active":""} onClick={()=>setTool("eraser")} aria-label="Eraser"><Eraser/></button>
          <button onClick={undo} aria-label="Undo"><ArrowCounterClockwise/></button><button onClick={clear} aria-label="Clear"><Trash/></button>
        </aside>
        <div className="studio">
          <div className="canvas-shell">
            <img ref={leafRef} className="leaf-mask-source" src="/assets/nescafe-leaf.png" alt="" />
            <div className="leaf-image" style={{backgroundColor:leafColor}} role="img" aria-label="NESCAFÉ leaf drawing canvas" />
            <DrawingCanvas canvasRef={canvasRef} color={color} tool={tool} size={size} onHistory={snapshot}/>
            <span className="canvas-hint">YOUR WORLD STARTS HERE</span>
          </div>
        </div>
        <aside className="stickers"><span>DROP A DOODLE</span><div>{STICKERS.map(s=><motion.button whileHover={{scale:1.06,rotate:-2}} whileTap={{scale:.92}} key={s.src} onClick={()=>addSticker(s)}><img src={s.src} alt={s.label}/><b>+</b></motion.button>)}</div></aside>
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
            <input type="color" value={color} onChange={e=>{setColor(e.target.value);setTool("pen");}} />
            <span className="picker-swatch" style={{background:color}} />
          </label>
          <div className="swatch-group">
            {INK_COLORS.map(c=>(
              <button key={c} onClick={()=>{setColor(c);setTool("pen")}} className={color===c?"swatch selected":"swatch"} style={{background:c}} aria-label={`Use ink color ${c}`} />
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
              <input type="color" value={leafColor} onChange={e=>setLeafColor(e.target.value)} />
              <span className="picker-swatch" style={{background:leafColor}} />
            </label>
            <div className="swatch-group">
              {LEAF_COLORS.map(c=>(
                <button key={c} onClick={()=>setLeafColor(c)} className={leafColor===c?"swatch selected":"swatch"} style={{background:c}} aria-label={`Use leaf color ${c}`} />
              ))}
            </div>
          </div>

          <div className="dock-divider" />

          <div className="stroke-section">
            <div className="dock-badge" title="Stroke size">
              <PaintBrush size={18} weight="fill" className="dock-icon" />
            </div>
            <label className="stroke-slider" title="Adjust stroke size">
              <input type="range" min="4" max="42" value={size} onChange={e=>setSize(+e.target.value)} />
              <b style={{width:Math.max(5,size/1.7),height:Math.max(5,size/1.7)}} />
            </label>
          </div>
        </div>
      </div>

      <button className="send-btn" onClick={send} disabled={sending}><span>{sending?"LAUNCHING...":"SEND TO THE WORLD"}</span><PaperPlaneTilt weight="fill"/></button>
    </motion.main>
  );
}

function World({ image, onAgain, onBack }) {
  const reduce=useReducedMotion();
  const flyers=[image,"/assets/sticker-love.png","/assets/sticker-secret.png","/assets/sticker-dance.png","/assets/sticker-snack.png"];
  return (
    <motion.main className="world screen" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:1}}>
      <div className="stars"/><header className="world-head"><button className="nav-back world-back" onClick={onBack} aria-label="Back to editor"><ArrowLeft/> <span>BACK</span></button><Brand compact/><span>03 / 03 — YOUR WORLD IS LIVE</span></header>
      <div className="world-copy"><motion.p initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:.6}}><Check weight="bold"/> DESIGN RECEIVED</motion.p><motion.h2 initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} transition={{delay:.75,duration:.8}}>WELCOME TO<br/><i>OUR WORLD.</i></motion.h2></div>
      <div className="planet"><img src="/assets/earth.jpg" alt="Glowing Earth"/><img className="planet-brand" src="/assets/nescafe-logo.png" alt="NESCAFÉ Make your world"/></div>
      {flyers.map((src,i)=><motion.div key={i} className={`flyer flyer-${i}`} initial={{opacity:0,scale:.2,x:0,y:180}} animate={{opacity:1,scale:1,x:reduce?0:[0,(i%2?18:-20),0],y:reduce?0:[0,-18,0],rotate:reduce?0:[i*8-16,i*8-9,i*8-16]}} transition={{opacity:{delay:1+i*.17,duration:.6},scale:{delay:1+i*.17,type:"spring"},x:{repeat:Infinity,duration:5+i},y:{repeat:Infinity,duration:4.4+i*.4},rotate:{repeat:Infinity,duration:6+i}}}><div className="mini-leaf"><img src={src} alt={i===0?"Your design":"Community doodle"}/></div></motion.div>)}
      <motion.div className="world-bottom" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1.5}}><p>Your mark is now orbiting with a world of imagination.</p><button onClick={onAgain}>CREATE ANOTHER <ArrowRight/></button></motion.div>
    </motion.main>
  );
}

export default function Home(){
  const[stage,setStage]=useState("landing");
  const[design,setDesign]=useState(null);
  const[restored,setRestored]=useState(false);

  useLayoutEffect(()=>{
    const savedStage=sessionStorage.getItem("nescafe-stage");
    const savedDesign=sessionStorage.getItem("nescafe-design");
    if(savedStage==="editor"||(savedStage==="world"&&savedDesign)) setStage(savedStage);
    if(savedDesign) setDesign(savedDesign);
    setRestored(true);
  },[]);

  useEffect(()=>{
    if(!restored)return;
    sessionStorage.setItem("nescafe-stage",stage);
    if(design) sessionStorage.setItem("nescafe-design",design);
  },[stage,design,restored]);

  if(!restored)return null;

  return <AnimatePresence mode="wait">{stage==="landing"&&<Landing key="landing" onStart={()=>setStage("editor")}/>} {stage==="editor"&&<Editor key="editor" onBack={()=>setStage("landing")} onSend={(img)=>{setDesign(img);setStage("world")}}/>} {stage==="world"&&<World key="world" image={design} onBack={()=>setStage("editor")} onAgain={()=>setStage("editor")}/>}</AnimatePresence>
}
