import Image from "next/image"

import { cn } from "@/lib/utils"

import { ImageZoom } from "./kibo-ui/image-zoom"

export function YouTubeEmbed({
  videoId,
  title,
}: {
  videoId: string
  title: string
}) {
  return (
    <div className="relative my-[1.25em]">
      <iframe
        className="aspect-video w-full rounded-xl"
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />

      <div className="pointer-events-none absolute inset-0 rounded-xl inset-ring-1 inset-ring-black/10 dark:inset-ring-white/10" />
    </div>
  )
}

export function IframeEmbed({
  className,
  ...props
}: React.ComponentProps<"iframe">) {
  return (
    <div className="relative my-[1.25em]">
      <iframe
        className={cn("aspect-video w-full rounded-xl", className)}
        {...props}
      />

      <div className="pointer-events-none absolute inset-0 rounded-xl inset-ring-1 inset-ring-black/10 dark:inset-ring-white/10" />
    </div>
  )
}

/**
 * A framed, zoomable image at full content width.
 *
 * `width`/`height` are the source image's intrinsic dimensions. They set the
 * aspect ratio so the browser reserves space before the file arrives, and they
 * drive the generated srcset — pass the real numbers, not a guess.
 *
 * NOTE: the MDX pipeline only forwards string-literal attributes, so callers in
 * `.mdx` must write `width="1400"` and `priority="true"` rather than the JSX
 * expression form `width={1400}` / bare `priority`. Expression-valued
 * attributes are silently dropped before the component ever sees them, which is
 * why `priority` is coerced from a string below.
 */
export function FramedImage({
  canZoom = true,
  alt,
  priority,
  width,
  height,
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof Image>,
  "alt" | "width" | "height" | "priority"
> & {
  canZoom?: boolean
  /** Required: every image in a post carries real descriptive alt text. */
  alt: string
  width: number | `${number}`
  height: number | `${number}`
  priority?: boolean | "true" | "false"
}) {
  const image = (
    <Image
      alt={alt}
      width={width}
      height={height}
      priority={priority === true || priority === "true"}
      className={cn("h-auto w-full", className)}
      sizes="(min-width: 1024px) 768px, 100vw"
      {...props}
    />
  )

  return (
    <figure className="relative [&_img]:rounded-xl">
      {canZoom ? <ImageZoom>{image}</ImageZoom> : image}

      <div className="pointer-events-none absolute inset-0 rounded-xl inset-ring-1 inset-ring-black/10 dark:inset-ring-white/10" />
    </figure>
  )
}

/** Responsive grid wrapper for a cluster of `Photo` items inside MDX. */
export function Gallery({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "not-prose my-[1.25em] grid grid-cols-2 gap-3 sm:grid-cols-3",
        className
      )}
      {...props}
    />
  )
}

/**
 * A framed, zoomable gallery photo with an optional caption. Uniform 4:3 crop
 * keeps grids tidy; zooming reveals the full, uncropped image.
 */
export function Photo({
  src,
  alt,
  caption,
  className,
}: {
  src: string
  alt?: string
  caption?: string
  className?: string
}) {
  return (
    <figure className={cn("m-0 flex flex-col gap-2", className)}>
      <div className="relative [&_img]:rounded-xl">
        <ImageZoom>
          <Image
            src={src}
            alt={alt ?? caption ?? ""}
            /**
             * Nominal 4:3 box, not the source dimensions. Sources vary between
             * portrait and landscape; `object-cover` crops them all to the same
             * ratio, so these describe the rendered box and keep the generated
             * srcset aligned with the size actually displayed.
             */
            width={1200}
            height={900}
            sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 50vw"
            className="aspect-[4/3] w-full object-cover"
          />
        </ImageZoom>

        <div className="pointer-events-none absolute inset-0 rounded-xl inset-ring-1 inset-ring-black/10 dark:inset-ring-white/10" />
      </div>

      {caption ? (
        <figcaption className="text-center text-xs text-pretty text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
