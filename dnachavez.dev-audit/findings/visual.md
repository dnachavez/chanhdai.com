# Visual and mobile rendering findings

**Category score: 78/100** (revised up from 71 after the search-bar finding was retracted on direct testing — see below)

Screenshots captured with Playwright/Chromium at 1440px (desktop) and 390px (mobile) on 2026-07-24. The specialist agent captured all 16 files but was cut off before writing its analysis; the analysis below was performed by the audit coordinator reading the captures directly.

**Screenshots viewed for this analysis:** `home-mobile.png`, `home-desktop.png`, `blog-post-mobile.png`, `testimonials-mobile.png`. The `-full` variants for the graduation post were not opened — at 15.8 MB and 9.2 MB they are impractical to read and their content is covered by the viewport captures plus the static image analysis in `images.md`.

## What works

- **No horizontal overflow at 390px on any page.** Every capture fits the viewport cleanly.
- **Typography is highly legible on mobile.** Generous line height, comfortable measure, strong contrast. The graduation post in particular reads well on a phone.
- **The identity is clear above the fold on mobile.** `home-mobile.png` shows the photo, "Dan Chavez" with a verification badge, and "AI Engineer" all within the first viewport.
- **Contact details are visible above the fold to human visitors** — `home-mobile.png` shows job title, Cebu City, local time, phone, email, website, and pronouns as a clean labelled list, followed immediately by seven social icons. For a recruiter landing on the page this is genuinely good. (The SEO problem is that none of it is in the HTML — see `sxo.md`.)
- **The design system is consistent and confident.** The blueprint grid, monospace metadata, and `FIG_001` framing read as a deliberate engineering aesthetic rather than a template.
- **Social icons are well-sized for touch** — roughly 44px targets with clear separation.
- **Layout adapts properly, not just proportionally.** The contact list is one column on mobile and two on desktop.

## Findings

### ~~Medium — The floating search bar overlays body text on mobile~~ — RETRACTED, not a defect

**This finding was wrong and is withdrawn.** It was based on over-reading a mid-scroll screenshot; no fix is needed and none was applied.

What `blog-post-mobile.png` actually shows is two intentional things. The faded text near the viewport bottom is a deliberate fade-to-background gradient declared in `src/app/(app)/layout.tsx:20-26` (`--fade-bottom-height`, `pointer-events-none`, masked) — a design element present on every page, not the control bleeding through. And the pill itself is already opaque (`bg-popover`, `src/components/site-bottom-nav.tsx:25`), roughly 280px wide and centred, so it occludes cleanly rather than half-legibly.

The question that actually mattered — whether the *last* content on a page can scroll clear of a fixed bar — was tested directly by serving the production build and screenshotting both blog posts scrolled to the bottom at 390px. The footer renders in full with clear space beneath it before the pill. Nothing is unreachable or obscured at rest.

Content scrolling underneath a fixed mobile nav mid-scroll is standard behaviour, not a defect.

### Medium — Blog posts show no visible byline, date, or reading time

Evidence: `blog-post-mobile.png`. Below the H1 "The long way to magna cum laude" the page goes straight to the description, then "On this page", then body copy. There is no author name, no publication date, and no reading time anywhere in the header.

The dates exist in JSON-LD and in `article:published_time`, so machines can read them — but human-visible authorship and dating are established E-E-A-T signals, and a reader arriving from search has no way to tell how current the piece is. This corroborates the same finding in `content.md` from the rendering side.

**Fix:** add a byline row under the title in `src/app/(app)/(docs)/blog/[slug]/page.tsx` — author name linking to `/`, formatted publish date, and reading time. The data is already available in `doc.metadata`.

### Medium — `/testimonials` renders as a mostly empty page on mobile

Evidence: `testimonials-mobile.png`. Two testimonial cards occupy the top ~55% of the viewport; the remaining ~45% is blank white space with no footer, no call to action, and no next step. The page reads as unfinished.

The second testimonial compounds this: it uses a generic Upwork wordmark in place of a person's photo (the first testimonial has a real avatar), and its text carries an unresolved `// TODO` link in the source data while displaying a verified badge.

**Fix:** either enrich the page — more testimonials, project context per quote, a closing "work with me" CTA — or fold the two quotes into the homepage and redirect `/testimonials`. A 112-word page with 45% empty space is not earning its place in the sitemap. Files: `src/app/(app)/(pages)/testimonials/page.tsx`, `src/features/portfolio/data/testimonials.tsx`.

### Low — The mobile hero spends the first third of the viewport on decoration

Evidence: `home-mobile.png`. The isometric `FIG_001` line drawing occupies roughly the top 30% of the first viewport before "Dan Chavez" appears. The name and role do still land above the fold, so this is a trade-off rather than a defect — but on shorter devices it will push the role below the fold, and it is the largest single element competing with the identity it frames.

**Fix:** optional. Reducing the graphic's height on small viewports would pull the identity and contact block higher without changing the design language.

### Low — Desktop wastes roughly 45% of horizontal space

Evidence: `home-desktop.png` at 1440px. Content is constrained to a centre column of about 770px with large empty margins either side. This is a deliberate and defensible editorial choice — it matches the blueprint aesthetic and keeps the measure readable — but the contact block in particular could use the width it already has rather than wrapping into two narrow columns.

**Fix:** none required. Noted for completeness.

### Info — No broken images, overlaps, or clipped content found

Every image rendered correctly in all four captures. No overlapping elements other than the search bar noted above, no clipped text, no missing assets.

### Info — Layout shift is not a visual problem

Lighthouse measured CLS 0.0 on `/`, `/blog`, and `/blog/the-long-way-to-magna-cum-laude`. The 84 `<Photo>` images carry `aspect-[4/3] w-full object-cover` (`src/components/embed.tsx:96-100`), which reserves space via CSS despite the missing `width`/`height` attributes. Only the 2 `<FramedImage>` instances lack any reservation. This is fragile — it depends on a utility class rather than intrinsic dimensions — but it is not currently causing shift, and should not be reported as a CLS failure.

### Info — Slow LCP is not visible in these captures

Homepage LCP measured 9.0 s and `/blog` 8.7 s (lab, mobile). Screenshots are taken after load settles, so they show the finished state and cannot illustrate the delay. The cause is payload and hydration, not a slow-painting hero — see `performance.md`.

## Screenshot inventory

The 16 primary captures in `dnachavez.dev-audit/screenshots/`. The directory also contains 12 `crop_mobile_NN.png` files — horizontal slices of a tall mobile capture produced by the specialist agent while working around the size of the full-page images; they are working artifacts, not separate views.

| File                            | Size    |
| ------------------------------- | ------- |
| `home-desktop.png`              | 167 KB  |
| `home-desktop-full.png`         | 1.1 MB  |
| `home-mobile.png`               | 244 KB  |
| `home-mobile-full.png`          | 2.2 MB  |
| `blog-desktop.png`              | 140 KB  |
| `blog-desktop-full.png`         | 181 KB  |
| `blog-mobile.png`               | 376 KB  |
| `blog-mobile-full.png`          | 465 KB  |
| `blog-post-desktop.png`         | 461 KB  |
| `blog-post-desktop-full.png`    | 9.2 MB  |
| `blog-post-mobile.png`          | 216 KB  |
| `blog-post-mobile-full.png`     | 15.8 MB |
| `testimonials-desktop.png`      | 51 KB   |
| `testimonials-desktop-full.png` | 93 KB   |
| `testimonials-mobile.png`       | 115 KB  |
| `testimonials-mobile-full.png`  | 191 KB  |

The 9.2 MB and 15.8 MB full-page captures of the graduation post are themselves a useful data point: they are large because the page really does render 86 full-resolution photographs.
