"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <motion.main
      className="landing landing-simple screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.55 }}
    >
      <motion.img
        className="landing-earth"
        src="/assets/earth.jpg"
        alt="Earth glowing beneath the stars"
        initial={{ scale: 1.06 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        className="landing-center"
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.8 }}
      >
        <img
          className="landing-logo"
          src="/assets/nescafe-logo.png"
          alt="NESCAFÉ — Make your world"
        />
        <motion.button
          className="start-btn landing-start"
          onClick={() => router.push("/edit")}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span>START</span>
        </motion.button>
      </motion.div>
    </motion.main>
  );
}
