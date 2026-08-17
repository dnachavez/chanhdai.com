/**
 * Preloaded via `node --import` ahead of the bundle script.
 *
 * Four portfolio data modules are `.tsx` because they carry lucide icons as JSX
 * (`icon: <CodeXmlIcon />`). tsx transforms those with esbuild's classic JSX
 * runtime when it loads them through the CJS path, which emits bare
 * `React.createElement` calls and throws `React is not defined` at import time.
 * Next.js never hits this — it compiles the same files with the automatic
 * runtime — so the mismatch only exists for the build script.
 *
 * Putting React on the global satisfies the classic runtime and is inert under
 * the automatic one, so the script works either way without depending on how
 * tsx happens to resolve its transform config.
 *
 * This lives in `--import` rather than at the top of the script because ESM
 * hoists imports: a statement inside the script would run *after* the data
 * modules it needs to precede, and Prettier's import sorter would reorder a
 * side-effect import anyway.
 */

import React from "react"

globalThis.React = React
