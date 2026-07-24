import type { ReactElement, ReactNode } from "react"

/** Public URL of the generated tech-stack icon sprite. */
export const TECH_STACK_SPRITE_URL = "/tech-stack-sprite.svg"

/** Symbol id for a tech-stack item's icon within the sprite. */
export function techStackSymbolId(key: string) {
  return `tech-${key}`
}

// SVG attributes that keep their camelCase spelling; every other camelCase
// React prop (strokeWidth, strokeLinecap, ...) maps to kebab-case in markup.
const CAMELCASE_SVG_ATTRS = new Set(["viewBox", "preserveAspectRatio"])

function toAttrName(prop: string) {
  if (prop === "className") return "class"
  if (CAMELCASE_SVG_ATTRS.has(prop)) return prop
  return prop.replace(/([A-Z])/g, "-$1").toLowerCase()
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
}

/**
 * Serializes a static SVG React element to markup without pulling in
 * `react-dom/server`, which Next.js disallows in the app graph. Deliberately
 * minimal: it covers exactly what the icon set uses -- host tags, pure
 * (hookless) function components, string/array children -- and nothing more.
 */
export function serializeSvgNode(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map((child) => serializeSvgNode(child as ReactNode)).join("")
  }

  const element = node as ReactElement<Record<string, unknown>>
  const { type, props } = element

  // Resolve a pure function component (the imported icon wrappers) by calling
  // it. These take only props and render synchronously, so this is safe.
  if (typeof type === "function") {
    return serializeSvgNode(
      (type as (p: Record<string, unknown>) => ReactNode)(props)
    )
  }
  if (typeof type !== "string") {
    // Fragment or similar: emit children only.
    return serializeSvgNode(props.children as ReactNode)
  }

  const { children, ...attrs } = props
  const attrString = Object.entries(attrs)
    .filter(([, value]) => value != null && value !== false)
    .map(([key, value]) => `${toAttrName(key)}="${escapeAttr(String(value))}"`)
    .join(" ")

  const openTag = attrString ? `<${type} ${attrString}>` : `<${type}>`
  return `${openTag}${serializeSvgNode(children as ReactNode)}</${type}>`
}

/** Unwraps function-component icon wrappers down to the underlying `<svg>`. */
function resolveSvgElement(icon: ReactNode) {
  let node = icon as ReactElement<Record<string, unknown>>

  while (node && typeof node.type === "function") {
    const render = node.type as (p: Record<string, unknown>) => ReactNode
    node = render(node.props) as ReactElement<Record<string, unknown>>
  }

  return (node?.props ?? {}) as Record<string, unknown>
}

/**
 * The icon's own viewBox. Badges need this to size their `<use>` box: the set
 * is not uniformly 24x24, and forcing one value distorts the outliers.
 */
export function getSvgViewBox(icon: ReactNode): string {
  return (resolveSvgElement(icon).viewBox as string) ?? "0 0 24 24"
}

// Props that belong to the rendered <svg>, not to a sprite <symbol>.
const NON_INHERITED_SVG_PROPS = new Set([
  "children",
  "className",
  "viewBox",
  "xmlns",
  "aria-hidden",
  "role",
])

/**
 * Resolves an icon element to a sprite `<symbol>`: its viewBox, its inner
 * shapes, and any presentation attributes declared on the `<svg>` itself.
 *
 * That last part matters. Several icons set `fill`, `stroke`, `stroke-width`
 * and friends on the root `<svg>` and let their paths inherit them. Copying
 * only the viewBox silently strips that styling and the icon renders wrong.
 */
export function extractSvgSymbol(icon: ReactNode): {
  viewBox: string
  attrs: string
  inner: string
} {
  const props = resolveSvgElement(icon)

  const attrs = Object.entries(props)
    .filter(
      ([key, value]) =>
        !NON_INHERITED_SVG_PROPS.has(key) && value != null && value !== false
    )
    .map(([key, value]) => `${toAttrName(key)}="${escapeAttr(String(value))}"`)
    .join(" ")

  return {
    viewBox: (props.viewBox as string) ?? "0 0 24 24",
    attrs,
    inner: serializeSvgNode(props.children as ReactNode),
  }
}
