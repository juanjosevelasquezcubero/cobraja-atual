import { createFileRoute } from "@tanstack/react-router";
import { CobraApp } from "@/components/cobra-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CobraApp />;
}
