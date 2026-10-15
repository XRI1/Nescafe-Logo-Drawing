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
  const p0 = { x: -180, y: height * 0.52 };
  const p1 = { x: width * 0.5, y: height * 0.04 };
  const p2 = { x: width + 180, y: height * 0.52 };
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

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// A random wavy route that always travels left to right, as two chained curves.
function randomFlight(width, height) {
  const margin = 180;
  const round = Math.round;
  const x0 = -margin;
  const x1 = width + margin;
  const span = x1 - x0;
  const yAt = () => randomBetween(0.12, 0.88) * height;
  const amplitude = randomBetween(0.18, 0.4) * height;
  const midY = randomBetween(0.3, 0.7) * height;
  // Alternate the bends up/down (random side first) so the route reads as a wave.
  const dir = Math.random() < 0.5 ? -1 : 1;
  const clampY = (y) => Math.min(height * 0.92, Math.max(height * 0.08, y));
  const startY = yAt();
  const endY = yAt();
  const c1 = { x: x0 + span * randomBetween(0.1, 0.25), y: clampY(midY + dir * amplitude) };
  const c2 = { x: x0 + span * randomBetween(0.3, 0.42), y: clampY(midY + dir * amplitude) };
  const mid = { x: x0 + span * 0.5, y: clampY(midY + randomBetween(-0.1, 0.1) * height) };
  const c3 = { x: x0 + span * randomBetween(0.58, 0.7), y: clampY(midY - dir * amplitude) };
  const c4 = { x: x0 + span * randomBetween(0.75, 0.9), y: clampY(midY - dir * amplitude) };
  const pt = (q) => `${round(q.x)} ${round(q.y)}`;
  return {
    path: `path("M ${round(x0)} ${round(startY)} C ${pt(c1)} ${pt(c2)} ${pt(mid)} C ${pt(c3)} ${pt(c4)} ${round(x1)} ${round(endY)}")`,
    scale: randomBetween(0.8, 1.2),
    wobble: randomBetween(-12, 12)
  };
}

function getSafeSlotCount(width, height) {
  const pathLength = calculatePathLength(width, height);
  // Leaf visual width in CSS is clamp(230px, 6vw + 160px, 295px)
  const leafWidth = Math.min(295, Math.max(230, 0.06 * width + 160));
  const effectiveWidth = leafWidth * 1.05;
  const minCenterDistance = effectiveWidth + 24;
  const computed = Math.floor(pathLength / minCenterDistance);

  // Provides 6 slots on desktop/laptop (>= 960px) to reduce distance by ~100px
  // while ensuring non-overlapping, continuous flight
  if (width >= 2200) {
    return Math.max(7, computed);
  }
  if (width >= 960) {
    return Math.max(6, computed);
  }
  if (width >= 640) {
    return Math.max(5, computed);
  }
  return Math.max(3, computed);
}

export default function NescafePage() {
  const [slots, setSlots] = useState([]);
  const listRef = useRef([]); // every known design, oldest to newest
  const cursorRef = useRef(0);
  const lastShownRef = useRef(null);
  const priorityQueueRef = useRef([]); // fresh uploads, shown next in upload order
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);
  const slotCountRef = useRef(0);

  // Next design in chronological order (looping), never the same one twice in a row.
  const pickNextDesign = useCallback(() => {
    let next = priorityQueueRef.current.shift();
    if (!next) {
      const list = listRef.current;
      if (!list.length) return null;
      next = list[cursorRef.current++ % list.length];
      if (list.length > 1 && next.id === lastShownRef.current) {
        next = list[cursorRef.current++ % list.length];
      }
    }
    lastShownRef.current = next.id;
    return next;
  }, []);

  // Slot 0 is furthest along (leaves first) and gets the oldest design, so
  // leaves enter the screen one after another in chronological order.
  const buildSlots = useCallback((count) => {
    slotCountRef.current = count;
    return Array.from({ length: count }, (_, index) => ({
      slotIndex: index,
      design: pickNextDesign(),
      flight: randomFlight(window.innerWidth, window.innerHeight),
      delay: -((count - 1 - index) * FLIGHT_SECONDS) / count
    }));
  }, [pickNextDesign]);

  const handleSlotIteration = useCallback((slotIndex) => {
    const nextDesign = pickNextDesign();
    // Every pass takes a new random route, even when there is no new design to show.
    const flight = randomFlight(window.innerWidth, window.innerHeight);

    setSlots((current) =>
      current.map((s) =>
        s.slotIndex === slotIndex ? { ...s, design: nextDesign || s.design, flight } : s
      )
    );
  }, [pickNextDesign]);

  const addToList = useCallback((design) => {
    if (!listRef.current.some((d) => d.id === design.id)) listRef.current.push(design);
  }, []);

  const startIfNeeded = useCallback(() => {
    if (initializedRef.current || !listRef.current.length) return;
    initializedRef.current = true;
    setSlots(buildSlots(getSafeSlotCount(window.innerWidth, window.innerHeight)));
  }, [buildSlots]);

  const acceptDesign = useCallback(async (design) => {
    if (!design?.id || !design?.imageUrl || seenRef.current.has(design.id)) return;
    seenRef.current.add(design.id);
    const ready = await preloadDesign(design);
    if (!ready) {
      seenRef.current.delete(design.id);
      return;
    }

    addToList(ready);
    if (initializedRef.current) {
      // Fresh upload takes the very next slot boundary.
      priorityQueueRef.current.push(ready);
    } else {
      startIfNeeded();
    }
  }, [addToList, startIfNeeded]);

  const reconcile = useCallback(async () => {
    try {
      const response = await fetch(`/api/designs?limit=30`, { cache: "no-store" });
      if (!response.ok) return;
      const { designs = [] } = await response.json();
      if (!designs.length) return;

      const ready = (await Promise.all(designs.map(preloadDesign))).filter(Boolean);
      const fresh = ready.filter((d) => !seenRef.current.has(d.id));
      ready.forEach((d) => {
        seenRef.current.add(d.id);
        addToList(d);
      });

      if (!initializedRef.current) {
        startIfNeeded();
        return;
      }
      priorityQueueRef.current.push(...fresh);
    } catch {
      // EventSource reconnects automatically
    }
  }, [addToList, startIfNeeded]);

  useEffect(() => {
    const handleResize = () => {
      if (!initializedRef.current) return;
      const newTarget = getSafeSlotCount(window.innerWidth, window.innerHeight);
      if (newTarget !== slotCountRef.current) setSlots(buildSlots(newTarget));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [buildSlots]);

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

  return (
    <motion.main className="screen nescafe-world-screen live-world" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.65 }}>
      <img className="landing-earth" src="/assets/earth.webp" alt="Earth glowing beneath the stars" />
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
              offsetPath: slot.flight.path,
              "--flight-scale": slot.flight.scale,
              "--flight-wobble": `${slot.flight.wobble}deg`,
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
