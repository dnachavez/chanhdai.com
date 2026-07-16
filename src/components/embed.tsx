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

export function FramedImage({
  canZoom = true,
  ...props
}: React.ComponentProps<"img"> & {
  canZoom?: boolean
}) {
  // eslint-disable-next-line jsx-a11y/alt-text
  const image = <img {...props} />

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
          {}
          <img
            src={src}
            alt={alt ?? caption ?? ""}
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
