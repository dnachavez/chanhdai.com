import { FloatingActions } from "@/components/floating-actions"
import { SiteBottomNav } from "@/components/site-bottom-nav"
import { SiteFooterCad } from "@/components/site-footer-cad"
import { SiteHeader } from "@/components/site-header"
import { ChatProvider } from "@/features/chat/components/chat-provider"
import { HighlightOnArrival } from "@/features/chat/components/highlight-on-arrival"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // References:
    // - https://base-ui.com/react/overview/quick-start#portals
    // - https://base-ui.com/react/overview/quick-start#ios-26-safari
    /*
      `ChatProvider` wraps the whole layout, not just the launcher, so the
      launcher and the /chat page read the same conversation — and so closing the
      panel does not unmount the thread.
    */
    <ChatProvider>
      <div className="group/layout relative isolate">
        <SiteHeader />
        <main className="max-w-screen overflow-x-clip px-2">{children}</main>
        <SiteFooterCad />
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50"
          aria-hidden
        >
          <div className="h-(--fade-bottom-height) bg-linear-to-b from-transparent to-background mask-linear-[to_top,var(--background)_25%,transparent] backdrop-blur-[1px]" />
          <div className="bg-background pb-[env(safe-area-inset-bottom,0)]" />
        </div>
        <SiteBottomNav />
        {/*
          Mounted here rather than on each linkable page: it is inert without a
          `?hl=` parameter, and one mount covers /experience, /projects,
          /testimonials, the homepage anchors and every blog post.
        */}
        <HighlightOnArrival />
        {/*
          Mounted after the bottom fade so the buttons paint above it. Both sit
          at z-50; the fade is pointer-events-none, so only stacking order
          matters.
        */}
        <FloatingActions />
      </div>
    </ChatProvider>
  )
}
