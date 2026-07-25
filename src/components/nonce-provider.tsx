"use client"

import { createContext, useContext } from "react"

const NonceContext = createContext<string | undefined>(undefined)

/**
 * Client components cannot read request headers, so the root layout hands the
 * nonce down instead of every `InlineScript` call site drilling it through
 * props.
 */
export function NonceProvider({
  nonce,
  children,
}: {
  nonce?: string
  children: React.ReactNode
}) {
  return <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>
}

export function useNonce() {
  return useContext(NonceContext)
}
