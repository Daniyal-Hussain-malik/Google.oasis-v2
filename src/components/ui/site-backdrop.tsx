import React from 'react';
import { Box } from '@mui/material';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { useAppTheme } from '@/src/context/ThemeContext';

/**
 * Site-wide Shadcn + Material UI ambient architectural backdrop.
 * Combines subtle theme-aware radial atmospheric glows, a masked Shadcn hairline grid,
 * and whisper-thin Katpana dune / Karakoram contour curves behind all public & admin views.
 */
export function SiteBackdrop() {
  const { mode } = useAppTheme();
  const prefersReducedMotion = useReducedMotion();
  const isDark = mode === 'dark';

  return (
    <MotionConfig reducedMotion="user">
      <Box
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
        sx={{
          backgroundColor: 'var(--background)',
          transition: 'background-color 250ms ease',
        }}
      >
        {/* Top-right Katpana amber sun-wash radial aura */}
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : { opacity: [0.82, 1, 0.82], scale: [1, 1.04, 1] }
          }
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 right-[-10%] h-[540px] w-[720px] rounded-full will-change-transform"
          style={{
            background: isDark
              ? 'radial-gradient(closest-side, rgba(232,148,58,0.14), rgba(232,148,58,0.04) 55%, transparent 100%)'
              : 'radial-gradient(closest-side, rgba(217,119,36,0.11), rgba(217,119,36,0.03) 55%, transparent 100%)',
          }}
        />

        {/* Mid-left Karakoram alpine slate mist */}
        <Box
          className="absolute top-[34%] -left-40 h-[520px] w-[620px] rounded-full"
          sx={{
            background: isDark
              ? 'radial-gradient(closest-side, rgba(56,189,248,0.07), rgba(17,27,46,0.05) 60%, transparent 100%)'
              : 'radial-gradient(closest-side, rgba(19,32,56,0.06), rgba(19,32,56,0.02) 60%, transparent 100%)',
          }}
        />

        {/* Bottom-right warm sandstone dusk aura */}
        <Box
          className="absolute -bottom-40 right-[8%] h-[460px] w-[660px] rounded-full"
          sx={{
            background: isDark
              ? 'radial-gradient(closest-side, rgba(232,148,58,0.09), transparent 72%)'
              : 'radial-gradient(closest-side, rgba(217,119,36,0.075), transparent 72%)',
          }}
        />

        {/* Masked Shadcn architectural hairline grid */}
        <Box
          className="absolute inset-0"
          sx={{
            opacity: isDark ? 0.22 : 0.42,
            backgroundImage:
              'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 85% 75% at 50% 30%, #000 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 50% 30%, #000 30%, transparent 100%)',
          }}
        />

        {/* Minimalist Katpana dune & Karakoram contour lines */}
        <svg
          className="absolute inset-x-0 bottom-0 h-[55vh] w-full"
          viewBox="0 0 1440 420"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 295C240 235 460 340 740 275C1010 212 1220 285 1440 225"
            stroke="var(--border)"
            strokeWidth="1.2"
            strokeOpacity={isDark ? 0.45 : 0.75}
          />
          <path
            d="M0 345C290 295 520 385 820 325C1090 270 1265 330 1440 288"
            stroke="var(--accent)"
            strokeWidth="1"
            strokeOpacity={isDark ? 0.14 : 0.16}
          />
          <path
            d="M0 390C360 355 610 415 940 368C1170 336 1315 378 1440 352"
            stroke="var(--border)"
            strokeWidth="1"
            strokeOpacity={isDark ? 0.35 : 0.6}
          />
        </svg>
      </Box>
    </MotionConfig>
  );
}
