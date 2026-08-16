import type { Testimonial } from "../types/testimonials"

// Long quotes (more than 50 characters), ordered by date ascending
export const TESTIMONIALS_1: Testimonial[] = [
  {
    authorAvatar: "/images/testimonials/nikka-bernal-batingana.png",
    authorName: "Nikka Bernal-Batingana",
    authorTagline: "Client · Lyons Global",
    url: "https://web.facebook.com/share/p/19Mt5QDyjA",
    quote:
      "I have worked with many website developers and my experience with this team has been the best. They redesigned our website from scratch in one week!",
    date: "2024-02-21",
  },
  {
    authorAvatar: "/images/testimonials/papu-borah.png",
    authorName: "Papu Borah",
    authorTagline: "Client · Upwork",
    url: "https://www.upwork.com",
    quote:
      "great service delivered as promised, Highliy recommend. Professional work done by him",
    date: "2024-01-23",
  },
  {
    authorAvatar: "/images/testimonials/louis-evans.webp",
    authorName: "Louis Evans",
    authorTagline: "Co-Founder & CTO · Aeva",
    url: "https://www.aevaai.com",
    quote:
      "We've been really happy with your performance at the company and would love to keep you on board for the long term.",
    date: "2026-06-21",
  },
  {
    authorAvatar: "/images/testimonials/john-nick-viduya.webp",
    authorName: "John Nick Viduya",
    authorTagline: "Tech Lead · Tolstoy & Framework",
    url: "https://www.nickviduya.com",
    quote:
      "Dan was our go to full stack engineer on Tolstoy and Framework, and he was especially strong on the AI side. He could take a rough idea, figure out the right approach, and ship something that actually worked in production, not just in a demo. He understands both the model layer and the product around it, which is rarer than people think. On top of that he was reliable and easy to work with. Clear communication, no ego, took feedback well, and kept things moving. I'd work with him again without hesitation.",
    date: "2026-08-16",
  },
]

// Short quotes (50 characters or fewer), ordered by date ascending
export const TESTIMONIALS_2: Testimonial[] = []
