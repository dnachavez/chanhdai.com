import type { Education } from "@/features/portfolio/types/education"

export const EDUCATION: Education[] = [
  {
    id: "uspf",
    school: "University of Southern Philippines Foundation",
    degree: "Bachelor of Science",
    fieldOfStudy: "Computer Science",
    period: {
      start: "08.2022",
      end: "07.2026",
    },
    description: `- Graduated Magna Cum Laude with a 1.44 GPA, earning a Bachelor of Science in Computer Science degree.
- Ranked the top graduate of the college among the graduating class, the highest academic standing in the department.
- Earned Dean's List honors in every semester of the program, from enrollment through graduation.
- Authored an undergraduate thesis, "Design and Implementation of a Cloud-Native Artificial Intelligence (AI) Call Center using Amazon Web Services and OpenAI," realized as Conduit — an autonomous voice agent that automates end-to-end call handling on fully serverless AWS infrastructure.
- Shipped 8+ notable projects spanning AI, IoT, and developer tooling:
  - Conduit — cloud-native AI call center on AWS and OpenAI (thesis project).
  - [AuggieGPT](https://auggiegpt.streamlit.app/), Buddy, and [SentiAI](https://github.com/dnachavez/fine-tuning-tinybert-for-sentiment-analysis) — conversational and sentiment-driven AI assistants.
  - [USPF IoT Parking System](https://github.com/dnachavez/iotparkingsystem) — real-time smart-parking platform bridging hardware and cloud.
  - CERTIfy, TESTIfy, and [SWARMIfy](https://github.com/gat-so/swarm) — automation and developer-productivity tooling.`,
    skills: [
      "AWS",
      "OpenAI",
      "Cloud-Native Architecture",
      "Serverless",
      "AI Agents",
      "IoT",
      "Distributed Systems",
      "Computer Science",
    ],
  },
  {
    id: "dumalag-cnhs",
    school: "Dumalag Central National High School",
    degree: "Senior High School",
    fieldOfStudy: "STEM Strand",
    period: {
      start: "08.2020",
      end: "07.2022",
    },
    description: `- Completed Senior High School under the Science, Technology, Engineering, and Mathematics (STEM) strand.
- Designed and built TrackTrace, a COVID-19 contact-tracing application, earning 3rd Place at the TCS Digital Innovation goIT App Development competition.`,
    skills: ["App Development", "Mobile Development", "STEM", "Prototyping"],
  },
]
