"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { useHotkeys } from "react-hotkeys-hook"

import { META_THEME_COLORS } from "@/config/site"
import { useClickSound } from "@/hooks/soundcn/use-click-sound"
import { useMetaColor } from "@/hooks/use-meta-color"

import { LaptopMinimalIcon } from "./animated-icons/laptop-minimal-icon"
import { MoonIcon } from "./animated-icons/moon-icon"
import { SunMediumIcon } from "./animated-icons/sun-medium-icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "./base/ui/tooltip"
import { Button } from "./ui/button"
import { Kbd } from "./ui/kbd"

const THEME_CYCLE = ["system", "light", "dark"] as const

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const { setMetaColor } = useMetaColor()

  const [click] = useClickSound()

  /**
   * The icon is picked in CSS off `data-theme-preference` on `<html>` rather
   * than off `theme`, which is unknown while the server renders. The inline
   * script in the root layout seeds the attribute before first paint; this
   * keeps it current afterwards, including for changes made from the command
   * menu.
   */
  useEffect(() => {
    if (theme) {
      document.documentElement.dataset.themePreference = theme
    }
  }, [theme])

  // Follows `resolvedTheme` so that "system" tracks the OS flipping under it.
  useEffect(() => {
    setMetaColor(
      resolvedTheme === "dark"
        ? META_THEME_COLORS.dark
        : META_THEME_COLORS.light
    )
  }, [resolvedTheme, setMetaColor])

  const switchTheme = () => {
    click()
    const current = THEME_CYCLE.indexOf(theme as (typeof THEME_CYCLE)[number])
    setTheme(THEME_CYCLE[(current + 1) % THEME_CYCLE.length])
  }

  useHotkeys("d", () => switchTheme())

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className="relative touch-manipulation border-none"
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle mode"
            onClick={() => switchTheme()}
          >
            <span
              className="absolute size-12 pointer-fine:hidden"
              aria-hidden
            />
            <LaptopMinimalIcon
              className="hidden in-data-[theme-preference=system]:block"
              aria-hidden
            />
            <SunMediumIcon
              className="hidden in-data-[theme-preference=light]:block"
              aria-hidden
            />
            <MoonIcon
              className="hidden in-data-[theme-preference=dark]:block"
              aria-hidden
            />
          </Button>
        }
      />
      <TooltipContent className="pr-2 pl-3">
        <div className="flex items-center gap-3">
          Toggle mode
          <Kbd>D</Kbd>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
