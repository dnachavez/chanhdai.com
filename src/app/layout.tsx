import "@/styles/globals.css"

import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import type { SearchAction, WebSite, WithContext } from "schema-dts"

import { JSON_LD_ID, personJsonLd } from "@/config/json-ld"
import { META_THEME_COLORS, SITE_INFO, X_HANDLE } from "@/config/site"
import { fontVariables } from "@/lib/fonts"
import { JsonLdScript } from "@/lib/json-ld"
import { Providers } from "@/components/providers"
import { USER } from "@/features/portfolio/data/user"

/**
 * `/blog` filters its posts off a `q` param, which is the only search the site
 * has. Declaring it is what lets the query box be offered against the site
 * directly rather than leaving it reachable only by landing on the page first.
 *
 * `query-input` binds the template variable and is required for that, but it
 * comes from the Actions spec rather than the core vocabulary, so schema-dts
 * does not model it -- hence the cast instead of dropping the property.
 */
const searchAction = {
  "@type": "SearchAction",
  target: {
    "@type": "EntryPoint",
    urlTemplate: `${SITE_INFO.url}/blog?q={search_term_string}`,
  },
  "query-input": "required name=search_term_string",
} as unknown as SearchAction

function getWebSiteJsonLd(): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": JSON_LD_ID.website,
    name: SITE_INFO.name,
    url: SITE_INFO.url,
    inLanguage: "en-US",
    author: personJsonLd,
    potentialAction: searchAction,
  }
}

// Thanks @shadcn-ui, @tailwindcss
const darkModeScript = String.raw`
  try {
    var pref = localStorage.theme === 'light' || localStorage.theme === 'dark' ? localStorage.theme : 'system'
    document.documentElement.dataset.themePreference = pref

    if (pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
    }
  } catch (_) {}

  try {
    if (/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
      document.documentElement.classList.add('os-macos')
    }
  } catch (_) {}
`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_INFO.url),
  title: {
    template: `%s – ${SITE_INFO.name}`,
    default: `${USER.displayName} – ${USER.jobTitle}`,
  },
  description: SITE_INFO.description,
  /**
   * Verifies a Search Console URL-prefix property without touching DNS, which
   * matters here: the zone lives on nameservers we can no longer edit. Emits
   * nothing when the env var is unset.
   */
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  authors: [
    {
      name: "dnachavez",
      url: SITE_INFO.url,
    },
  ],
  creator: "dnachavez",
  openGraph: {
    siteName: SITE_INFO.name,
    url: "/",
    type: "profile",
    locale: "en_US",
    firstName: USER.firstName,
    lastName: USER.lastName,
    username: USER.username,
    gender: USER.gender,
    images: [
      {
        url: SITE_INFO.ogImage,
        width: 1200,
        height: 630,
        alt: SITE_INFO.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: X_HANDLE,
    creator: X_HANDLE,
    images: [SITE_INFO.ogImage],
  },
  icons: {
    icon: [
      {
        url: "/images/favicon.ico",
        sizes: "32x32",
      },
      {
        url: "/images/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/images/favicon-dark.svg",
        sizes: "any",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: {
      url: "/images/apple-touch-icon.png",
      type: "image/png",
      sizes: "180x180",
    },
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: META_THEME_COLORS.light,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={fontVariables}
      // Matches `defaultTheme`; the head script below corrects it from
      // localStorage before anything paints.
      data-theme-preference="system"
      suppressHydrationWarning
    >
      <head>
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{ __html: darkModeScript }}
        />
        {/*
          Thanks @tailwindcss. We inject the script via the `<Script/>` tag again,
          since we found the regular `<script>` tag to not execute when rendering a not-found page.
         */}
        <Script src={`data:text/javascript;base64,${btoa(darkModeScript)}`} />
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var value = localStorage.getItem('avatarLights');
                document.documentElement.dataset.avatarLights = JSON.parse(value || '"on"');
              } catch(_) {}
            `,
          }}
        />
        {/*
          Declared here rather than via `metadata.alternates.types` because
          every page sets its own `alternates.canonical`, and Next.js replaces
          the parent `alternates` object wholesale instead of merging it — the
          feed link would survive only on pages that set no canonical.
         */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${SITE_INFO.name} — Blog`}
          href="/blog/rss"
        />

        <JsonLdScript data={getWebSiteJsonLd()} />
      </head>

      <body>
        <Providers>
          <NuqsAdapter>{children}</NuqsAdapter>
        </Providers>
      </body>
    </html>
  )
}
