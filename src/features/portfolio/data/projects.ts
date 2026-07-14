import type { Project } from "../types/projects"

export const PROJECTS: Project[] = [
  {
    id: "swarmify",
    title: "Swarmify",
    period: {
      start: "02.2026",
      end: "02.2026",
    },
    link: "https://github.com/gat-so/swarm",
    skills: [
      "Open Source",
      "TypeScript",
      "React",
      "AI Agents",
      "Simulation",
      "Docker",
    ],
    description:
      "Built an AI agent simulation panel with a game-like top-down view where agents appear as animated characters moving through a living mini-community.",
  },
  {
    id: "thinkofatitle",
    title: "ThinkOfATitle",
    period: {
      start: "04.2025",
      end: "04.2025",
    },
    link: "https://thinkofatitle.dnachavez.dev",
    skills: ["Next.js", "TypeScript", "Google Gemini", "Tailwind CSS"],
    description:
      "Built an AI-powered tool that generates creative, professional titles for academic papers, dissertations, theses, and research documents, powered by Google's Gemini 2.0 Flash.",
  },
  {
    id: "testify",
    title: "Testify",
    period: {
      start: "12.2024",
      end: "12.2024",
    },
    skills: [
      "AI",
      "Computer Vision",
      "Facial Recognition",
      "Canvas LMS",
      "Python",
    ],
    description:
      "Engineered an AI exam proctoring system with facial and behavioral analysis, integrated with Canvas LMS.",
  },
  {
    id: "sentiai",
    title: "SentiAI",
    period: {
      start: "04.2024",
      end: "04.2024",
    },
    link: "https://github.com/dnachavez/fine-tuning-tinybert-for-sentiment-analysis",
    skills: [
      "University Project",
      "Machine Learning",
      "Python",
      "TinyBERT",
      "Transformers",
      "PyTorch",
    ],
    description:
      "Built a sentiment analysis tool that classifies text into positive, negative, or neutral categories using a fine-tuned TinyBERT model.",
  },
  {
    id: "cetify",
    title: "Cetify",
    period: {
      start: "12.2023",
      end: "12.2023",
    },
    skills: ["AI", "Document Verification", "Authentication"],
    description:
      "Developed an AI-integrated academic record authentication system for verifying and validating academic credentials.",
  },
  {
    id: "uspf-iot-parking-system",
    title: "USPF IoT Parking System",
    period: {
      start: "12.2023",
      end: "12.2023",
    },
    link: "https://github.com/dnachavez/iotparkingsystem",
    skills: [
      "University Project",
      "IoT",
      "CodeIgniter 4",
      "PHP",
      "Arduino",
      "MySQL",
    ],
    description:
      "Built an IoT-based parking management system for the University of Southern Philippines Foundation (USPF), pairing a CodeIgniter 4 web app with Arduino Uno R4 WiFi hardware.",
  },
  {
    id: "philippine-scripts-translator",
    title: "Philippine Scripts Translator",
    period: {
      start: "11.2023",
      end: "11.2023",
    },
    link: "https://philippine-scripts-translator.netlify.app",
    skills: ["React", "JavaScript", "Unicode", "Netlify"],
    description:
      "Built a tool that translates modern Filipino text into ancient Philippine scripts encoded in the Unicode charts.",
  },
  {
    id: "buddy",
    title: "Buddy",
    period: {
      start: "06.2023",
      end: "06.2023",
    },
    skills: ["AI", "OpenAI", "DALL·E", "Chatbot", "Python"],
    description:
      "Built a university chatbot powered by OpenAI's GPT-3.5-turbo with DALL·E image generation and custom commands, providing quick access to a university-curated knowledge base.",
  },
  {
    id: "auggiegpt",
    title: "AuggieGPT",
    period: {
      start: "02.2023",
      end: "02.2023",
    },
    link: "https://auggiegpt.streamlit.app",
    skills: ["AI", "Streamlit", "OpenAI", "Python"],
    description:
      "Built a Streamlit chatbot assistant for the University of Southern Philippines Foundation (USPF) on OpenAI's GPT-3.5-turbo, answering university-specific queries.",
  },
]
