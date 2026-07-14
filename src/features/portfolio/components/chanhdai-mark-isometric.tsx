"use client"

import { useEffect, useId, useRef } from "react"
import type { Transition } from "motion/react"
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react"

import { metalClickSound } from "@/lib/soundcn/metal-click"
import { useSound } from "@/hooks/soundcn/use-sound"

const transition: Transition = {
  type: "spring",
  mass: 0.5,
  damping: 18,
  stiffness: 200,
}

/**
 * Designed by ncdai on Figma with [Fast Isometric Plugin](https://www.figma.com/community/plugin/1249759048471403961).
 * Inspired by tailwindcss.com.
 *
 * Letter order flipped to read "DC" on the original diagonal cascade:
 * D sits lower-left, C upper-right. Both letters were slid along the isometric
 * up-right axis (C by +332.55px x / -128px y, D by -166.275px x / +160px y),
 * preserving letterforms, the 27.7px clearance, the shared dashed construction
 * line, press animation, and grid alignment. Canvas is now 666x417.
 */
export function ChanhDaiMarkIsometric() {
  const id = useId()
  const ids = {
    facePattern: `ncdai-face-pattern-${id}`,
    faceFill: `ncdai-face-fill-${id}`,
    stroke: `ncdai-stroke-${id}`,
    radialGradient: `ncdai-radial-gradient-${id}`,
  }

  const ref = useRef<SVGSVGElement>(null)

  const [play] = useSound(metalClickSound)

  const shouldReduceMotion = useReducedMotion()
  const isInView = useInView(ref, { margin: "80px" })

  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  const cx = useSpring(useTransform(mouseX, [0, 1], [0, 666]), {
    stiffness: 300,
    damping: 30,
    mass: 0.1,
  })

  const cy = useSpring(useTransform(mouseY, [0, 1], [0, 417]), {
    stiffness: 300,
    damping: 30,
    mass: 0.1,
  })

  useEffect(() => {
    if (shouldReduceMotion || !isInView) {
      return
    }

    if (window.matchMedia("(hover: none)").matches) {
      return
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX / window.innerWidth)
      mouseY.set(e.clientY / window.innerHeight)
    }

    window.addEventListener("mousemove", handleMouseMove)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [shouldReduceMotion, isInView, mouseX, mouseY])

  return (
    <motion.svg
      ref={ref}
      className="h-auto w-full touch-manipulation overflow-visible [--pattern:color-mix(in_oklab,var(--foreground)_12%,var(--background))] [--stroke:color-mix(in_oklab,var(--foreground)_16%,var(--background))]"
      viewBox="0 0 666 417"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      initial="normal"
      whileTap="pressed"
      onTap={() => play()}
    >
      <defs>
        <pattern
          id={ids.facePattern}
          x="0"
          y="0"
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M-1 1l2 -2M0 10l10 -10M9 11l2 -2"
            stroke="var(--pattern)"
            strokeWidth="1"
          />
        </pattern>

        <motion.g
          id={ids.faceFill}
          variants={{
            normal: {
              transform: "translate(0px, 0px)",
            },
            pressed: {
              transform: "translate(0px, 16px)",
            },
          }}
          transition={transition}
        >
          <path d="M665.60 128.58L554.75 192.58L499.33 160.58L610.18 96.58L665.60 128.58Z" />
          <path d="M222.21 192.58L111.35 256.58L222.21 320.58L333.05 256.58L388.49 288.58L222.21 384.58L0.50 256.58L166.78 160.58L222.21 192.58Z" />
          <path d="M499.33 160.58L443.90 192.58L333.05 128.58L388.48 96.58L499.33 160.58Z" />
          <path d="M388.49 224.58L333.05 256.58L222.21 192.58L277.62 160.58L388.49 224.58Z" />
          <path d="M499.33 32.58L388.48 96.58L333.05 64.58L443.90 0.58L499.33 32.58Z" />
        </motion.g>

        <motion.path
          id={ids.stroke}
          variants={{
            normal: {
              d: [
                // C
                "M360.76 112.58 L333.05 96.58 V64.58 L443.90 0.58 L499.33 32.58 V64.58 L416.19 112.58",
                "M499.33 32.58 L333.05 128.58 V160.58 L443.90 224.58 L499.33 192.58 L554.75 224.58 L665.60 160.58 V128.58 L610.18 96.58 L499.33 160.58 L333.05 64.58",
                "M333.05 128.58 L443.90 192.58 L499.33 160.58 L554.75 192.58 L665.60 128.58",
                "M443.90 192.58 V224.58",
                "M499.33 160.58 V192.58",
                "M554.75 192.58 V224.58",
                // D
                "M333.05 256.58 L388.49 288.58 V320.58 L222.21 416.58 L0.50 288.58 V256.58 L166.78 160.58 L333.05 256.58",
                "M0.50 256.58 L222.21 384.58 L388.49 288.58",
                "M360.76 272.58 L388.49 256.58 V224.58 L277.62 160.58 L111.35 256.58 L222.21 320.58 L388.49 224.58",
                "M139.06 272.58 L222.21 224.58 L305.35 272.58",
                "M222.21 384.58 V416.58",
                "M222.21 192.58 V224.58",
              ].join(""),
            },
            pressed: {
              d: [
                // C
                "M374.62 120.58 L333.05 96.58 V80.58 L443.90 16.58 L499.33 48.58 V64.58 L402.33 120.58",
                "M499.33 48.58 L333.05 144.58 V160.58 L443.90 224.58 L499.33 192.58 L554.75 224.58 L665.60 160.58 V144.58 L610.18 112.58 L499.33 176.58 L333.05 80.58",
                "M333.05 144.58 L443.90 208.58 L499.33 176.58 L554.75 208.58 L665.60 144.58",
                "M443.90 208.58 V224.58",
                "M499.33 176.58 V192.58",
                "M554.75 208.58 V224.58",
                // D
                "M333.05 272.58 L388.49 304.58 V320.58 L222.21 416.58 L0.50 288.58 V272.58 L166.78 176.58 L333.05 272.58",
                "M0.50 272.58 L222.21 400.58 L388.49 304.58",
                "M346.92 280.58 L388.49 256.58 V240.58 L277.62 176.58 L111.35 272.58 L222.21 336.58 L388.49 240.58",
                "M125.21 280.58 L222.21 224.58 L319.20 280.58",
                "M222.21 400.58 V416.58",
                "M222.21 208.58 V224.58",
              ].join(""),
            },
          }}
          transition={transition}
        />

        <motion.radialGradient
          id={ids.radialGradient}
          cx={cx}
          cy={cy}
          r="200"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            className="dark:[stop-color:#fff]"
            stopColor="var(--color-zinc-700)"
          />
          <stop
            className="dark:[stop-color:var(--color-zinc-600)]"
            offset="1"
            stopColor="var(--color-zinc-400)"
            stopOpacity="0"
          />
        </motion.radialGradient>
      </defs>

      <g className="stroke-line" strokeWidth="1" strokeDasharray="4 2">
        <path d="M-394.41 772.57L1337.65 -227.41" />
        {/* <path d="M-699.25 692.57L1032.81 -307.41" /> */}
        <path d="M1309.92 660.58L-422.12 -339.42" />
        <path d="M977.38 852.58L-754.66 -147.42" />
        {/* <path d="M1171.38 772.57L-560.69 -227.41" /> */}
      </g>

      <g className="fill-background" fillRule="evenodd" clipRule="evenodd">
        <motion.path
          variants={{
            normal: {
              d: "M499.33 32.58L388.48 96.58L333.05 64.58V96.58L388.48 128.58L499.33 64.58V32.58Z",
            },
            pressed: {
              d: "M499.33 48.58L388.48 112.58L333.05 80.58V96.58L388.48 128.58L499.33 64.58V48.58Z",
            },
          }}
          transition={transition}
        />
        <motion.path
          variants={{
            normal: {
              d: "M499.33 160.58L443.90 192.58L333.05 128.58V160.58L443.90 224.58L499.33 192.58L554.75 224.58L665.60 160.58V128.58L554.75 192.58L499.33 160.58Z",
            },
            pressed: {
              d: "M499.33 176.58L443.90 208.58L333.05 144.58V160.58L443.90 224.58L499.33 192.58L554.75 224.58L665.60 160.58V144.58L554.75 208.58L499.33 176.58Z",
            },
          }}
          transition={transition}
        />
        <motion.path
          variants={{
            normal: {
              d: "M222.21 384.58L0.50 256.58V288.58L222.21 416.58L388.49 320.58V288.58L222.21 384.58Z",
            },
            pressed: {
              d: "M222.21 400.58L0.50 272.58V288.58L222.21 416.58L388.49 320.58V304.58L222.21 400.58Z",
            },
          }}
          transition={transition}
        />
        <motion.path
          variants={{
            normal: {
              d: "M222.21 192.58L111.35 256.58V288.58L222.21 224.58L333.05 288.58L388.48 256.58V224.58L333.05 256.58L222.21 192.58Z",
            },
            pressed: {
              d: "M222.21 208.58L111.35 272.58V288.58L222.21 224.58L333.05 288.58L388.48 256.58V240.58L333.05 272.58L222.21 208.58Z",
            },
          }}
          transition={transition}
        />
      </g>

      <use href={`#${ids.faceFill}`} className="fill-background" />
      <use href={`#${ids.faceFill}`} fill={`url(#${ids.facePattern})`} />

      <use href={`#${ids.stroke}`} stroke="var(--stroke)" />
      <use href={`#${ids.stroke}`} stroke={`url(#${ids.radialGradient})`} />
    </motion.svg>
  )
}
