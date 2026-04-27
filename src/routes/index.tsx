import { createFileRoute } from "@tanstack/react-router";
import ReachOut from "@/components/ReachOut";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReachOut — High School Outreach Engine" },
      { name: "description", content: "Find professors and professionals near you and generate ready-to-send outreach email drafts." },
    ],
  }),
  component: ReachOut,
});
