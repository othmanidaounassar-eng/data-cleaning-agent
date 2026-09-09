"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAppSettings } from "@/components/providers/app-providers";

const DOTS = 8;
const DOT_DELAY_MS = 2600;

/**
 * OQZARO boot splash: dark navy screen with a ring of spinning dots,
 * then the brand name, then the mission tagline. Calls `onFinish` when
 * the sequence completes so the caller can reveal the app underneath.
 */
export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const { t } = useAppSettings();
  const [showName, setShowName] = useState(false);
  const [showMission, setShowMission] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const nameTimer = window.setTimeout(() => setShowName(true), 850);
    const missionTimer = window.setTimeout(() => setShowMission(true), 1650);
    const finishTimer = window.setTimeout(() => {
      setFadingOut(true);
      window.setTimeout(onFinish, 450);
    }, DOT_DELAY_MS);
    return () => {
      window.clearTimeout(nameTimer);
      window.clearTimeout(missionTimer);
      window.clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a192f] overflow-hidden"
      animate={{ opacity: fadingOut ? 0 : 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {/* Subtle radial glow behind the ring */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(45% 45% at 50% 38%, rgba(79,124,255,0.14) 0%, rgba(79,124,255,0.04) 50%, transparent 75%)",
        }}
      />

      {/* Spinning ring of dots */}
      <motion.div
        className="relative w-24 h-24 mb-8"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
        aria-hidden="true"
      >
        {Array.from({ length: DOTS }).map((_, i) => {
          const angle = (i / DOTS) * 360;
          return (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 block w-3 h-3 rounded-full"
              style={{
                background: i % 2 === 0 ? "#4f7cff" : "#38bdf8",
                boxShadow: "0 0 12px rgba(79,124,255,0.55)",
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(42px)`,
              }}
            />
          );
        })}
      </motion.div>

      {/* Brand name */}
      {showName && (
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-4xl md:text-5xl font-extrabold tracking-tight text-white"
        >
          OQZARO
        </motion.h1>
      )}

      {/* Mission tagline */}
      {showMission && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mt-3 text-sm md:text-base text-white/60 text-center px-6 max-w-md"
        >
          {t("splash.mission")}
        </motion.p>
      )}
    </motion.div>
  );
}
