import {
  BinaryIcon,
  BookOpenIcon,
  BriefcaseBusinessIcon,
  CodeXmlIcon,
  LightbulbIcon,
  ServerIcon,
  ShieldIcon,
  SparklesIcon,
  SproutIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react"

import type { Experience } from "@/features/portfolio/types/experiences"

export const EXPERIENCES: Experience[] = [
  {
    id: "aeva",
    companyName: "Aeva AI Receptionist",
    companyLogo: "/images/companies/aeva.svg",
    companyWebsite: "https://www.aevaai.com",
    location: "Auckland, New Zealand",
    locationType: "Remote",
    positions: [
      {
        id: "1",
        title: "Full-stack Developer",
        employmentPeriod: {
          start: "02.2026",
        },
        icon: <CodeXmlIcon />,
        description: `- Spearheading full-stack development of Aeva, an AI-powered phone receptionist serving ~500 clinics and processing 100+ calls daily, built with React and Node.js on Heroku for 24/7 automated appointment booking, rescheduling, caller identification, and cancellations across Australia, New Zealand, the UK, Ireland, and Canada.
- Architected the voice AI integration layer connecting Vapi with custom voice models, conversation flows, real-time transcription, and squad-based assistant routing, Cliniko for practice management, and Twilio for telephony across 5 country-specific configurations with carrier-level routing and failover.
- Led migration of backend services and AI agents from Make.com to code, eliminating widespread missed-notification issues and reducing incident resolution time by 60%.
- Driving integration of additional practice management systems (Splose, Halaxy, Jane App) to broaden platform compatibility across allied health clinics.`,
        skills: [
          "React",
          "Node.js",
          "Heroku",
          "Vapi",
          "Twilio",
          "Cliniko",
          "Voice AI",
          "Real-time Transcription",
        ],
      },
    ],
    isCurrentEmployer: true,
  },
  {
    id: "goteam",
    companyName: "GoTeam",
    companyLogo: "/images/companies/goteam.webp",
    companyWebsite: "https://go.team",
    location: "Virginia Beach, VA",
    locationType: "Remote",
    positions: [
      {
        id: "1",
        title: "AI Specialist",
        employmentPeriod: {
          start: "06.2025",
          end: "02.2026",
        },
        icon: <SparklesIcon />,
        description: `- Led design and rollout of a multi-agent AI automation platform for [Fox Three Partners](https://fox3partners.com) across research, analysis, and project management workflows, reducing operational load by 70% for cross-functional U.S. client teams.
- Architected an n8n-based orchestration engine with intelligent task routing using a hybrid event-driven and scheduled approach, eliminating 100% of manual triage.
- Benchmarked OpenAI o4-mini against o3-deep-research for research agents, cutting research time by 80% while identifying 40% cost savings.
- Engineered a financial analysis agent that applies custom validation logic to operational data and returns flexible JSON, cutting parsing failures by 85%.
- Built a comment-triggered automation system with NLP-based intent classification, saving 15+ hours weekly in manual task administration at 95% accuracy.
- Shipped memory-aware document generation agents backed by curated knowledge banks, reducing document turnaround by 90%.
- Wired Zapier-driven synchronization between project management platforms and external databases, improving cross-system data consistency by 95%.
- Architected Next.js conversational agents with Supabase backends on Vercel Edge Functions, doubling content output while maintaining sub-100ms response times.
- Automated two-way calendar sync with Power Automate, eliminating manual calendar duplication and reducing scheduling conflicts by 80%.`,
        skills: [
          "n8n",
          "OpenAI",
          "Next.js",
          "Supabase",
          "Vercel",
          "Zapier",
          "Power Automate",
          "Prompt Engineering",
        ],
      },
    ],
  },
  {
    id: "framework",
    companyName: "Framework",
    companyIcon: <BriefcaseBusinessIcon strokeWidth={1.8} />,
    location: "Cebu City, Philippines",
    locationType: "Remote",
    positions: [
      {
        id: "1",
        title: "Founding Engineer",
        employmentPeriod: {
          start: "09.2024",
          end: "03.2025",
        },
        icon: <CodeXmlIcon />,
        description: `- Owned end-to-end design and solo development of an AI responder system, choosing retrieval-augmented generation (RAG) over fine-tuning to reach 92% response accuracy while cutting implementation time by 60%.
- Architected an AI Task Manager from zero to production with an event-driven architecture, enabling real-time orchestration that reduced customer response cycles by 50%.
- Designed serverless infrastructure on AWS Lambda with concurrency limits and dead-letter queues, maintaining 99.9% uptime while cutting infrastructure spend by 40%.
- Implemented circuit breaker and exponential backoff patterns to prevent cascade failures, reducing API timeout errors by 85%.
- Set technical direction independently as the sole engineer, defining the design patterns, API contracts, and error-handling conventions that later anchored team scaling.`,
        skills: [
          "RAG",
          "AWS Lambda",
          "Serverless",
          "Event-Driven Architecture",
          "AI",
        ],
      },
    ],
  },
  {
    id: "tolstoy",
    companyName: "Tolstoy",
    companyLogo: "/images/companies/tolstoy.svg",
    companyWebsite: "https://www.gotolstoy.com",
    location: "Denver, CO",
    locationType: "Remote",
    positions: [
      {
        id: "1",
        title: "Full-stack Engineer & AI Engineer",
        employmentPeriod: {
          start: "08.2024",
          end: "03.2025",
        },
        icon: <CodeXmlIcon />,
        description: `- Led architecture and rollout of a multi-agent AI communication system for an interactive video platform serving 10,000+ businesses, boosting response accuracy by 65% while maintaining sub-3s response times.
- Devised a weighted-parallel agent orchestration strategy with confidence-based ranking, reducing drafting time by 75% and token consumption by 40%.
- Established a prompt engineering framework with quantitative evaluation metrics and A/B testing, improving response quality scores by 40%.
- Consolidated 5+ communication channels into a unified inbox with a hybrid pull/push model that balanced real-time delivery against API rate limits.
- Re-architected serverless infrastructure onto an SQS-based queue with concurrent Lambda execution, enabling 3x request volume (30k to 90k monthly) at 99.9% uptime.
- Profiled execution patterns and right-sized resources, cutting infrastructure spend by 20% and p95 latency by 60%.
- Integrated the Linear API with webhook-triggered automation to streamline task management, reducing manual workload by 30%.
- Built a parallel ETL pipeline blending batch and streaming processing, improving data throughput by 250%.
- Hardened delivery with idempotency keys, at-least-once guarantees, and dead-letter queue monitoring, driving data-loss incidents from 12 per month to zero.
- Architected the technical foundation for a no-code AI workflow builder using a React Flow-based visual editor.
- Championed team-wide adoption of AI development tools (GitHub Copilot, Claude, Windsurf), reducing development cycle time by 30% across an 8-person team.
- Prototyped an automated customer onboarding flow, cutting ramp-up from 6 weeks to 3 and improving product activation by 40%.
- Mentored 3 junior engineers through structured onboarding, design reviews, and pair programming, reducing production bugs by 35%.`,
        skills: [
          "TypeScript",
          "React",
          "AWS Lambda",
          "SQS",
          "Multi-Agent AI",
          "Prompt Engineering",
          "React Flow",
          "Serverless",
        ],
      },
    ],
  },
  {
    id: "bilis",
    companyName: "Bilis Delivery",
    companyLogo: "/images/companies/bilis.webp",
    location: "Cebu City, Philippines",
    locationType: "Remote",
    positions: [
      {
        id: "1",
        title: "Lead Full-stack Developer",
        employmentPeriod: {
          start: "04.2024",
          end: "12.2025",
        },
        icon: <CodeXmlIcon />,
        description: `- Led architecture and development of a food delivery platform from concept to production, scaling to 10,000+ orders and 2,000+ users in the first year on a Laravel modular monolith at 99.9% uptime.
- Designed a real-time order tracking system with WebSockets and the Google Maps API, reducing API calls by 60% and customer support inquiries by 50%.
- Architected a payment abstraction layer (COD, credit card, in-app wallet) with Laravel Passport OAuth2 and SMS-based OTP, increasing payment success rate by 35%.
- Built a zone-based driver-matching engine ranking on proximity, vehicle type, and availability against Redis-cached driver state, cutting match time from 5 minutes to 90 seconds.
- Diagnosed and resolved performance bottlenecks with eager loading, strategic indexing, and Redis caching, reducing p95 load time from 3.2s to 0.8s.
- Combined optimistic locking, Laravel queue batch processing, and atomic transactions to sustain 100+ concurrent orders at peak without overselling inventory.
- Implemented multi-guard authentication for 4 user types, each with a distinct permission model, on Laravel Passport and custom guards.
- Built a granular RBAC system with JSON-configured permissions across 12+ modules, enabling non-engineers to manage access.
- Structured the backend as a modular monolith on nwidart/laravel-modules with strict boundaries, decoupling code and improving maintainability by 60%.`,
        skills: [
          "Laravel",
          "WebSocket",
          "Google Maps API",
          "Laravel Passport",
          "Redis",
          "MySQL",
          "OAuth2",
        ],
      },
    ],
  },
  {
    id: "develop-kreativity",
    companyName: "Develop Kreativity",
    companyLogo: "/images/companies/developkreativity.webp",
    companyWebsite: "https://www.developkreativity.com",
    location: "Cebu City, Philippines",
    locationType: "Remote",
    positions: [
      {
        id: "1",
        title: "Co-Founder & Chief Technology Officer",
        employmentPeriod: {
          start: "11.2023",
          end: "12.2025",
        },
        icon: <LightbulbIcon />,
        description: `- Co-founded a digital agency from zero to 15+ clients across healthcare, retail, and technology, delivering an integrated offering of brand strategy, AI automation, software development, UI/UX, and content production.
- Directed technical strategy and delivery for 30+ client projects, establishing reusable frameworks that cut custom development by 40% and project timelines by 50% at 95% client satisfaction.
- Built an AI automation practice using no-code platforms (Make, Zapier), reducing manual client operations by 50% and creating a recurring revenue stream.
- Standardized technology selection across client engagements with a decision matrix weighing complexity, timeline, and budget, enabling 20+ clients to scale their digital operations 3x.
- Grew a brand strategy practice that raised average client engagement by 60% and follower growth by 120% while cutting strategy development time by 50%.
- Established UI/UX and design-system practices in Figma, delivering 25+ redesigns that improved user satisfaction by 45%.
- Stood up a content production pipeline that delivered 100+ brand assets, increasing client social engagement by 80% while cutting production time by 35%.
- Rolled out AI chatbots for client lead generation, improving response times by 70% and lead conversion rates by 35%.
- Delivered notable public work, including the [Lyons Global](https://lyonsglobal.us) website redesign and an [LMS platform](https://lms.lyonsglobal.us) for a digital health solutions company.
- Scaled the team from 2 co-founders to 10+ developers, designers, and marketers.`,
        skills: [
          "Next.js",
          "Laravel",
          "WordPress",
          "Make",
          "Zapier",
          "Figma",
          "AI Automation",
          "Brand Strategy",
          "UI/UX Design",
          "Team Leadership",
        ],
      },
    ],
  },
  {
    id: "uspf",
    companyName: "University of Southern Philippines Foundation",
    companyLogo: "/images/companies/uspf.webp",
    companyWebsite: "https://uspf.edu.ph",
    location: "Cebu City, Philippines",
    locationType: "On-site",
    positions: [
      {
        id: "1",
        title: "Full-stack Developer",
        employmentPeriod: {
          start: "07.2023",
          end: "07.2026",
        },
        icon: <CodeXmlIcon />,
        description: `- Designed a multi-agent AI chat system with a LangGraph state-graph pipeline of specialized agents (admissions, registrar, financial), reaching 85% query resolution accuracy and reducing support staff workload by 40%.
- Architected a React Native mobile app consolidating digital ID, RFID attendance, statement-of-account, and payments, integrated with Pinnacle ERP, increasing digital service adoption by 35%.
- Built a Laravel and Vue.js [queue management system](https://kiosk.uspf.edu.ph/new-kiosk) with real-time WebSocket updates serving 500+ students daily, reducing wait times by 80%.
- Developed secure online election platforms ([JHS](https://jhselection.uspf.edu.ph), [SHS](https://shselection.uspf.edu.ph)) with cryptographic vote hashing and audit trails, enabling 3,000+ voters and cutting counting time from 1 hour to 15 minutes.
- Built an [electronic judging system](https://ejs.uspf.edu.ph) for university events, delivering real-time score tabulation and transparent, auditable judging.
- Created a digital repository for 2,000+ theses and research papers with Elasticsearch-powered search, improving research accessibility by 70%.
- Led a PowerEdge R440 infrastructure upgrade and deployed an on-premise [document resource management system](https://drms.uspf.edu.ph), improving workflow efficiency by 60%.`,
        skills: [
          "LangGraph",
          "React Native",
          "Laravel",
          "Vue.js",
          "WebSocket",
          "Elasticsearch",
          "MySQL",
          "Multi-Agent AI",
        ],
      },
    ],
  },
  {
    id: "mytoolz",
    companyName: "MyToolz",
    companyLogo: "/images/companies/mytoolz.webp",
    companyWebsite: "https://mytoolz.net",
    location: "Bangladesh",
    locationType: "Remote",
    positions: [
      {
        id: "1",
        title: "Back-end Developer",
        employmentPeriod: {
          start: "07.2021",
          end: "12.2021",
        },
        icon: <ServerIcon />,
        description: `- Rebuilt a high-traffic Blogger link locker after finding a client-side base64 masking vulnerability, migrating to an externally hosted API with AES encryption and ID obfuscation while maintaining sub-200ms response times.
- Implemented a strict HTTP referrer validation layer that reduced unauthorized content scraping by 70% without impacting legitimate traffic.
- Developed a multi-purpose PHP API toolkit (proxy detection, email verification, crypto balances, account checks) with rate limiting and caching, handling 10,000+ daily requests at sub-500ms p95 latency.
- Migrated validation logic in-house from third-party APIs, cutting operational costs by 50% and improving uptime from 97% to 99.5%.`,
        skills: ["PHP", "REST API", "AES Encryption", "cURL", "Rate Limiting"],
      },
    ],
  },
  {
    id: "where-it-all-started",
    companyName: "Where it all started",
    companyIcon: <SproutIcon strokeWidth={1.8} />,
    positions: [
      {
        id: "5",
        title: "Cloud & security rabbit holes",
        employmentPeriod: {
          start: "2019",
          end: "2021",
        },
        icon: <ShieldIcon />,
        description: `- Explored cloud infrastructure early on, deploying and running workloads across GCP and Windows servers on Azure.
- Built a foundation in security fundamentals through dorking and hands-on penetration testing tools like Havij.`,
        skills: [
          "GCP",
          "Azure",
          "Windows Server",
          "Penetration Testing",
          "Security",
        ],
      },
      {
        id: "4",
        title: "Teaching myself to build",
        employmentPeriod: {
          start: "2018",
          end: "2020",
        },
        icon: <BookOpenIcon />,
        description: `- Self-taught PHP, Java, and web development using early mobile web builders like WAPKA, WAP, and XHTML.
- Built websites and tools from scratch, years before any formal education.`,
        skills: ["PHP", "Java", "XHTML", "WAPKA", "Web Development"],
      },
      {
        id: "3",
        title: "Building tools & game mods",
        employmentPeriod: {
          start: "2017",
          end: "2019",
        },
        icon: <WrenchIcon />,
        description: `- Built a XenForo forum and mobile apps for Betamin, a Mobile Legends: Bang Bang hacks and tips community.
- Built [Netify VPN](https://www.ayodata.com.ng/2016/02/mtn-with-netify-vpn-settings-how-to-use.html), a Psiphon-based VPN handler for Android that provided free internet access by tunneling traffic through proxy configurations, gaining early experience in networking, tunneling protocols, and mobile app development.
- Developed [Drop Tools](https://phcorner.org/threads/drop-tools-mlbb-amazon-drop.963709/), an Android app that automated Amazon Prime reward drops in Mobile Legends: Bang Bang, with account creation, subscription renewal, account recovery, and a drop booster for claiming in-game loot, distributed through the PHCorner developer community.
- Built [Fakecez MLBB Mod Key Generator](https://www.youtube.com/shorts/Iy19xcgKgr0), automating API key retrieval for a cheat engine by bypassing ad-heavy redirect chains and collapsing a tedious multi-step process into a single action.`,
        skills: [
          "XenForo",
          "Android",
          "Java",
          "Psiphon",
          "Networking",
          "Automation",
          "Reverse Engineering",
        ],
      },
      {
        id: "2",
        title: "Growing up in dev communities",
        employmentPeriod: {
          start: "2016",
          end: "2021",
        },
        icon: <UsersIcon />,
        description: `- Collaborated with early Filipino developer communities including ZyberPH Developers and DDEV Philippines.
- Contributed to community projects and learned from peers in the local dev scene.`,
        skills: ["Open Source", "Community", "Collaboration"],
      },
      {
        id: "1",
        title: "The reverse-engineering days",
        employmentPeriod: {
          start: "2016",
          end: "2017",
        },
        icon: <BinaryIcon />,
        description: `- Reverse-engineered Android applications by decompiling APKs and reading Smali bytecode, learning how software works from the inside out.
- Traced compiled code to understand program structure and control flow, long before writing anything from scratch.`,
        skills: ["Reverse Engineering", "Smali", "APK Decompiling", "Android"],
      },
    ],
  },
]
