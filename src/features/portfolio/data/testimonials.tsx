import type { Testimonial } from "../types/testimonials"

// Long quotes (more than 50 characters), ordered by date ascending
export const TESTIMONIALS_1: Testimonial[] = [
  {
    authorAvatar: "/images/testimonials/nikka-bernal-batingana.png",
    authorName: "Nikka Bernal-Batingana",
    authorTagline: "Client · Develop Kreativity",
    url: "https://web.facebook.com/share/p/19Mt5QDyjA",
    quote:
      "I have worked with many website developers and my experience with this team has been the best. They redesigned our website from scratch in one week!",
    date: "2024-02-21",
  },
  {
    authorAvatar: "https://unavatar.io/upwork.com",
    authorName: "Papu Borah",
    authorTagline: "Client · Upwork",
    url: "https://www.upwork.com",
    quote:
      "great service delivered as promised, Highliy recommend. Professional work done by him",
    date: "2024-01-23",
    isVerified: true,
  },
]

// Short quotes (50 characters or fewer), ordered by date ascending
export const TESTIMONIALS_2: Testimonial[] = []
