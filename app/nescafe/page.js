"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

const FLIGHT_SECONDS = 22;

function preloadDesign(design) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      let glowColor = "rgb(255 255 255)";
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, 32, 32);
        const pixels = context.getImageData(0, 0, 32, 32).data;
        let red = 0, green = 0, blue = 0, weight = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3] / 255;
          if (alpha < 0.15) continue;
          red += pixels[index] * alpha;
          green += pixels[index + 1] * alpha;
          blue += pixels[index + 2] * alpha;
          weight += alpha;
        }
        if (weight) glowColor = `rgb(${Math.round(red / weight)} ${Math.round(green / weight)} ${Math.round(blue / weight)})`;
      } catch {}
      resolve({ ...design, glowColor });
    };
    image.onerror = () => resolve(null);
    image.src = design.imageUrl;
  });
}

function calculatePathLength(width, height) {
  const p0 = { x: -250, y: height * 0.52 };
  const p1 = { x: width * 0.5, y: height * 0.04 };
  const p2 = { x: width + 250, y: height * 0.52 };
  let length = 0;
  let prev = p0;
  const steps = 30;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const pt = {
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
    };
    length += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return length;
}

function getSafeSlotCount(width, height) {
  const pathLength = calculatePathLength(width, height);
  // Leaf visual width in CSS is clamp(276px, 9vw + 200px, 376px) scaled by up to ~1.08
  const leafWidth = Math.min(376, Math.max(276, 0.09 * width + 200));
  const effectiveWidth = leafWidth * 1.08;
  // Safety gap ensures leaves never touch or overlap along the curve
  const safeGap = Math.max(75, width * 0.05);
  const minCenterDistance = effectiveWidth + safeGap;
  return Math.max(2, Math.floor(pathLength / minCenterDistance));
}

export default function NescafePage() {
  const [slots, setSlots] = useState([]);
  const [viewport, setViewport] = useState({ width: 1920, height: 1080 });
  const poolQueueRef = useRef([]);
  const priorityQueueRef = useRef([]);
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);

  const handleSlotIteration = useCallback((slotIndex) => {
    let nextDesign = null;
    if (priorityQueueRef.current.length > 0) {
      nextDesign = priorityQueueRef.current.shift();
    } else if (poolQueueRef.current.length > 0) {
      nextDesign = poolQueueRef.current.shift();
    }

    if (!nextDesign) return;

    setSlots((current) => {
      const currentSlot = current.find((s) => s.slotIndex === slotIndex);
      if (currentSlot?.design) {
        poolQueueRef.current.push(currentSlot.design);
      }
      return current.map((s) =>
        s.slotIndex === slotIndex ? { ...s, design: nextDesign } : s
      );
    });
  }, []);

  const acceptDesign = useCallback(async (design) => {
    if (!design?.id || !design?.imageUrl || seenRef.current.has(design.id)) return;
    seenRef.current.add(design.id);
    const ready = await preloadDesign(design);
    if (!ready) {
      seenRef.current.delete(design.id);
      return;
    }

    setSlots((current) => {
      const targetCount = getSafeSlotCount(window.innerWidth, window.innerHeight);
      if (current.length === 0) {
        // If no slots exist yet, initialize all slots cycling this design
        const initialSlots = Array.from({ length: targetCount }, (_, index) => ({
          slotIndex: index,
          design: ready,
          delay: -(index * FLIGHT_SECONDS) / targetCount
        }));
        return initialSlots;
      }
      // Prioritize the freshly uploaded design for the very next slot boundary
      priorityQueueRef.current.push(ready);
      return current;
    });
  }, []);

  const reconcile = useCallback(async () => {
    try {
      const response = await fetch(`/api/designs?limit=30`, { cache: "no-store" });
      if (!response.ok) return;
      const { designs = [] } = await response.json();
      if (!designs.length) return;

      const ready = (await Promise.all(designs.map(preloadDesign))).filter(Boolean);
      ready.forEach((d) => seenRef.current.add(d.id));

      const targetCount = getSafeSlotCount(window.innerWidth, window.innerHeight);

      if (!initializedRef.current) {
        const initialSlots = Array.from({ length: targetCount }, (_, index) => ({
          slotIndex: index,
          design: ready[index % ready.length],
          delay: -(index * FLIGHT_SECONDS) / targetCount
        }));
        poolQueueRef.current = ready.slice(targetCount);
        setSlots(initialSlots);
        initializedRef.current = true;
        return;
      }

      for (const d of ready) {
        if (!seenRef.current.has(d.id)) {
          seenRef.current.add(d.id);
          priorityQueueRef.current.push(d);
        }
      }
    } catch {
      // EventSource reconnects automatically
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewport({ width, height });

      const newTarget = getSafeSlotCount(width, height);
      setSlots((current) => {
        if (!current.length || current.length === newTarget) return current;
        const designs = current.map((s) => s.design).filter(Boolean);
        if (!designs.length) return current;
        return Array.from({ length: newTarget }, (_, index) => ({
          slotIndex: index,
          design: designs[index % designs.length],
          delay: -(index * FLIGHT_SECONDS) / newTarget
        }));
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    reconcile();
    const source = new EventSource("/api/designs/stream");
    source.addEventListener("connected", reconcile);
    source.addEventListener("design.created", (event) => {
      try { acceptDesign(JSON.parse(event.data)); } catch {}
    });
    source.onerror = () => reconcile();
    return () => source.close();
  }, [acceptDesign, reconcile]);

  const flightPath = `path("M -250 ${Math.round(viewport.height * 0.52)} Q ${Math.round(viewport.width * 0.5)} ${Math.round(viewport.height * 0.04)} ${viewport.width + 250} ${Math.round(viewport.height * 0.52)}")`;

  return (
    <motion.main className="screen nescafe-world-screen live-world" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.65 }}>
      <img className="landing-earth" src="/assets/earth.jpg" alt="Earth glowing beneath the stars" />
      <div className="world-center-wrap" aria-hidden="true">
        <img className="world-logo" src="/assets/nescafe-logo.png" alt="" />
      </div>
      <div className="flight-layer" aria-label="Live NESCAFÉ designs">
        {slots.map((slot) => (
          <div
            key={`slot-${slot.slotIndex}`}
            className="flight-design"
            style={{
              animationDelay: `${slot.delay}s`,
              offsetPath: flightPath,
              "--flight-scale": 0.82 + (slot.slotIndex % 4) * 0.08,
              "--flight-wobble": `${-7 + (slot.slotIndex % 5) * 3}deg`,
              "--design-glow": slot.design?.glowColor || "rgb(255 255 255)"
            }}
            onAnimationIteration={() => handleSlotIteration(slot.slotIndex)}
          >
            {slot.design?.imageUrl && (
              <img className="flight-design-image" src={slot.design.imageUrl} alt="Community-designed NESCAFÉ leaf" />
            )}
          </div>
        ))}
      </div>
    </motion.main>
  );
}
