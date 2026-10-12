"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

    fetch("/api/designs")
      .then((res) => res.json())
      .then((data) => setImage(data.designs?.at(-1)?.image || null))
      .catch(() => setImage(null));
  }, []);

  return (
    <motion.main
      className="screen nescafe-world-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <motion.img
        className="landing-earth"
        src="/assets/earth.jpg"
        alt="Earth glowing beneath the stars"
        initial={{ scale: 1.04 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />

      <button
        className="world-icon-back"
        onClick={() => router.push("/edit")}
        aria-label="Back to editor"
      >
        <ArrowLeft />
      </button>

      {/* Centered NESCAFÉ Logo under the world horizon */}
      <motion.div
        className="world-center-wrap"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      >
        <img
          className="world-logo"
          src="/assets/nescafe-logo.png"
          alt="NESCAFÉ — Make your world"
        />
      </motion.div>

      {/* User's Design Orbiting in Space */}
      {image && (
        <motion.div
          className="saved-design-flyer"
          initial={{ opacity: 0, scale: 0.25, x: 40, y: 60, rotate: -20 }}
          animate={{
            opacity: 1,
            scale: 1,
            x: reduce ? 0 : [0, 16, 0],
            y: reduce ? 0 : [0, -16, 0],
            rotate: reduce ? -8 : [-12, -4, -12]
          }}
          transition={{
            opacity: { delay: 0.8, duration: 0.7 },
            scale: { delay: 0.8, type: "spring", stiffness: 90, damping: 14 },
            x: { repeat: Infinity, duration: 6, ease: "easeInOut" },
            y: { repeat: Infinity, duration: 5, ease: "easeInOut" },
            rotate: { repeat: Infinity, duration: 7, ease: "easeInOut" }
          }}
        >
          <img src={image} alt="Your flying design" />
        </motion.div>
      )}
    </motion.main>
  );
}
