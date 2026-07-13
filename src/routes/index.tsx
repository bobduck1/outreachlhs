import { createFileRoute } from "@tanstack/react-router";
import ReachOut from "@/components/ReachOut";
import AuthGate from "@/components/AuthGate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReachOut — High School Outreach Engine" },
      { name: "description", content: "Find professors and professionals and generate ready-to-send outreach email drafts." },
    ],
  }),
  component: () => (
    <AuthGate>
      <ReachOut />
    </AuthGate>
  ),
});
