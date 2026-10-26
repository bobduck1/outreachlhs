import { createFileRoute } from "@tanstack/react-router";
import ReachOut from "@/components/ReachOut";
import AuthGate from "@/components/AuthGate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReachOut — High School Outreach Engine" },
      { name: "description", content: "Find university professors by major and location and prepare research-assistance outreach drafts for high school students." },
      { property: "og:title", content: "ReachOut — High School Outreach Engine" },
      { property: "og:description", content: "Connect with university professors in your field and prepare personalized research-assistance outreach." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AuthGate>
      <ReachOut />
    </AuthGate>
  ),
});
