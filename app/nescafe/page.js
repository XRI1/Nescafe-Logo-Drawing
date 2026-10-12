"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

const SLOT_COUNT = 10;
const FLIGHT_SECONDS = 22;

function preloadDesign(design) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(design);
    image.onerror = () => resolve(null);
    image.src = design.imageUrl;
  });
}

export default function NescafePage() {
  const [slots, setSlots] = useState([]);
  const [viewport, setViewport] = useState({ width: 1920, height: 1080 });
  const queueRef = useRef([]);
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);

  const acceptDesign = useCallback(async (design) => {
    if (!design?.id || !design?.imageUrl || seenRef.current.has(design.id)) return;
    seenRef.current.add(design.id);
    const ready = await preloadDesign(design);
    if (!ready) {
      seenRef.current.delete(design.id);
      return;
    }
    setSlots((current) => {
      if (current.length < SLOT_COUNT) {
        return [...current, { slotId: crypto.randomUUID(), design: ready, delay: 0, revision: 0 }];
      }
      queueRef.current.push(ready);
      return current;
    });
  }, []);

  const reconcile = useCallback(async () => {
    try {
      const response = await fetch(`/api/designs?limit=${SLOT_COUNT}`, { cache: "no-store" });
      if (!response.ok) return;
      const { designs = [] } = await response.json();
      if (!initializedRef.current) {
        const ready = (await Promise.all(designs.map(preloadDesign))).filter(Boolean);
        ready.forEach((design) => seenRef.current.add(design.id));
        setSlots(ready.map((design, index) => ({
          slotId: crypto.randomUUID(),
          design,
          delay: -(index * FLIGHT_SECONDS) / Math.max(ready.length, 1),
          revision: 0
        })));
        initializedRef.current = true;
        return;
      }
      for (const design of designs) await acceptDesign(design);
    } catch {
      // EventSource reconnects automatically; its next connection reconciles again.
    }
  }, [acceptDesign]);

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
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

  const flightPath = `path("M -250 ${Math.round(viewport.height * 0.52)} Q ${Math.round(viewport.width * 0.5)} ${Math.round(viewport.height * -0.08)} ${viewport.width + 250} ${Math.round(viewport.height * 0.52)}")`;

  const replaceAtBoundary = (slotId) => {
    if (!queueRef.current.length) return;
    setSlots((current) => {
      const oldest = [...current].sort((a, b) => new Date(a.design.createdAt) - new Date(b.design.createdAt))[0];
      if (!oldest || oldest.slotId !== slotId || !queueRef.current.length) return current;
      const next = queueRef.current.shift();
      return current.map((slot) => slot.slotId === slotId
        ? { ...slot, design: next, delay: 0, revision: slot.revision + 1 }
        : slot);
    });
  };

  return (
    <motion.main className="screen nescafe-world-screen live-world" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.65 }}>
      <img className="landing-earth" src="/assets/earth.jpg" alt="Earth glowing beneath the stars" />
      <div className="world-center-wrap" aria-hidden="true">
        <img className="world-logo" src="/assets/nescafe-logo.png" alt="" />
      </div>
      <div className="flight-layer" aria-label="Live NESCAFÉ designs">
        {slots.map((slot, index) => (
          <img
            key={`${slot.slotId}-${slot.revision}`}
            className="flight-design"
            src={slot.design.imageUrl}
            alt="Community-designed NESCAFÉ leaf"
            style={{
              animationDelay: `${slot.delay}s`,
              offsetPath: flightPath,
              "--flight-scale": 0.82 + (index % 4) * 0.08,
              "--flight-wobble": `${-7 + (index % 5) * 3}deg`
            }}
            onAnimationIteration={() => replaceAtBoundary(slot.slotId)}
          />
        ))}
      </div>
    </motion.main>
  );
}
