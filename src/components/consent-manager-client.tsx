"use client"

import { ClientSideOptionsProvider } from "@c15t/nextjs/client"

import { getPostHogConfig } from "@/lib/posthog"

export function ConsentManagerClient({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClientSideOptionsProvider
      callbacks={{
        onConsentSet({ preferences }) {
          if (!getPostHogConfig()) {
            return
          }

          // Deferred so mounting the consent manager does not pull posthog-js
          // into the initial chunk of whichever page renders it.
          void import("posthog-js").then(({ posthog }) => {
            if (preferences.measurement) {
              posthog.opt_in_capturing()
            } else {
              posthog.opt_out_capturing()
            }
          })
        },
      }}
    >
      {children}
    </ClientSideOptionsProvider>
  )
}
