"use client"

import { useCallback, useImperativeHandle, useRef } from "react"
import type { Transition, Variants } from "motion/react"
import { motion, useAnimation } from "motion/react"

import { cn } from "@/lib/utils"

export type LaptopMinimalIconHandle = {
  startAnimation: () => void
  stopAnimation: () => void
}

export type LaptopMinimalIconProps = React.ComponentPropsWithoutRef<"div"> & {
  ref?: React.Ref<LaptopMinimalIconHandle>
  size?: number
}

const screenVariants: Variants = {
  normal: { y: 0 },
  animate: { y: [0, -1.5, 0] },
}

const screenTransition: Transition = {
  duration: 0.6,
  ease: "easeInOut",
}

export function LaptopMinimalIcon({
  ref,
  onMouseEnter,
  onMouseLeave,
  className,
  size = 24,
  ...props
}: LaptopMinimalIconProps) {
  const controls = useAnimation()
  const isControlledRef = useRef(false)

  useImperativeHandle(ref, () => {
    isControlledRef.current = true

    return {
      startAnimation: () => controls.start("animate"),
      stopAnimation: () => controls.start("normal"),
    }
  })

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isControlledRef.current) {
        controls.start("animate")
      } else {
        onMouseEnter?.(e)
      }
    },
    [controls, onMouseEnter]
  )

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isControlledRef.current) {
        controls.start("normal")
      } else {
        onMouseLeave?.(e)
      }
    },
    [controls, onMouseLeave]
  )

  return (
    <div
      className={cn(className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.rect
          width="18"
          height="12"
          x="3"
          y="4"
          rx="2"
          ry="2"
          variants={screenVariants}
          animate={controls}
          transition={screenTransition}
        />
        <path d="M2 20h20" />
      </svg>
    </div>
  )
}
