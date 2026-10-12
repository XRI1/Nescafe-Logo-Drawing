"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function Brand({ compact = false }) {
  return (
    <img
      className={compact ? "brand brand--compact" : "brand"}
      src="/assets/nescafe-logo.png"
      alt="NESCAFÉ — Make your world"
    />
  );
}

export default function NescafePage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("nescafe-design");
      if (saved) {
        setImage(saved);
        return;
      }
    }

    // Fallback: try to fetch latest design from API or use default leaf asset
    fetch("/api/designs")
      .then((res) => res.json())
      .then((data) => {
        if (data.designs && data.designs.length > 0) {
          setImage(data.designs[data.designs.length - 1].image);
        } else {
          setImage("/assets/nescafe-leaf.png");
        }
      })
      .catch(() => {
        setImage("/assets/nescafe-leaf.png");
      });
  }, []);

  const flyers = [
    image || "/assets/nescafe-leaf.png",
    "/assets/sticker-love.png",
    "/assets/sticker-secret.png",
    "/assets/sticker-dance.png",
    "/assets/sticker-snack.png"
  ];

  return (
    <motion.main
      className="world screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="stars" />

      <header className="world-head">
        <button
          className="nav-back world-back"
          onClick={() => router.push("/edit")}
          aria-label="Back to editor"
        >
          <ArrowLeft /> <span>BACK</span>
        </button>
        <Brand compact />
        <span>03 / 03 — YOUR WORLD IS LIVE</span>
      </header>

      <div className="world-copy">
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Check weight="bold" /> DESIGN RECEIVED
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.8 }}
        >
          WELCOME TO<br />
          <i>OUR WORLD.</i>
        </motion.h2>
      </div>

      <div className="planet">
        <img src="/assets/earth.jpg" alt="Glowing Earth" />
        <img className="planet-brand" src="/assets/nescafe-logo.png" alt="NESCAFÉ Make your world" />
      </div>

      {flyers.map((src, i) => (
        <motion.div
          key={i}
          className={`flyer flyer-${i}`}
          initial={{ opacity: 0, scale: 0.2, x: 0, y: 180 }}
          animate={{
            opacity: 1,
            scale: 1,
            x: reduce ? 0 : [0, i % 2 ? 18 : -20, 0],
            y: reduce ? 0 : [0, -18, 0],
            rotate: reduce ? 0 : [i * 8 - 16, i * 8 - 9, i * 8 - 16]
          }}
          transition={{
            opacity: { delay: 0.6 + i * 0.15, duration: 0.6 },
            scale: { delay: 0.6 + i * 0.15, type: "spring" },
            x: { repeat: Infinity, duration: 5 + i },
            y: { repeat: Infinity, duration: 4.4 + i * 0.4 },
            rotate: { repeat: Infinity, duration: 6 + i }
          }}
        >
          <div className="mini-leaf">
            <img src={src} alt={i === 0 ? "Your design" : "Community doodle"} />
          </div>
        </motion.div>
      ))}

      <motion.div
        className="world-bottom"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <p>Your mark is now orbiting with a world of imagination.</p>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <button onClick={() => router.push("/edit")}>
            CREATE ANOTHER <ArrowRight />
          </button>
        </div>
      </motion.div>
    </motion.main>
  );
}
