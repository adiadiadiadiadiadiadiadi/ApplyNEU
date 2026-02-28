import { Briefcase, Send, Eye, CheckCircle, XCircle, Clock } from "lucide-react";

export interface TaskItem {
  id: string;
  title: string;
  company: string;
  description: string;
  status: "pending" | "applied" | "interview" | "offer" | "rejected";
  date: string;
}

export const tasks: TaskItem[] = [
  { id: "1", title: "Frontend Engineer", company: "Stripe", description: "Build payment UI components using React and TypeScript. Team of 8, remote-first.", status: "applied", date: "Feb 18" },
  { id: "2", title: "Full Stack Developer", company: "Vercel", description: "Work on Next.js infrastructure and developer tools. Strong focus on DX.", status: "interview", date: "Feb 17" },
  { id: "3", title: "React Developer", company: "Linear", description: "Help build the fastest project management tool. Performance-obsessed team.", status: "pending", date: "Feb 19" },
  { id: "4", title: "Software Engineer", company: "Figma", description: "Work on real-time collaboration features. WebSocket and Canvas experience preferred.", status: "offer", date: "Feb 14" },
  { id: "5", title: "UI Engineer", company: "Notion", description: "Build block-based editor components. Deep knowledge of contenteditable required.", status: "rejected", date: "Feb 10" },
  { id: "6", title: "Platform Engineer", company: "Datadog", description: "Scale monitoring infrastructure serving millions of metrics per second.", status: "applied", date: "Feb 16" },
  { id: "7", title: "Frontend Architect", company: "Shopify", description: "Lead frontend architecture for merchant dashboard. Polaris design system.", status: "pending", date: "Feb 19" },
  { id: "8", title: "Senior React Dev", company: "GitHub", description: "Improve code review experience with rich diff views and inline commenting.", status: "applied", date: "Feb 15" },
];

export const statusConfig: Record<TaskItem["status"], { label: string; icon: typeof Briefcase; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "text-muted-foreground" },
  applied: { label: "Applied", icon: Send, color: "text-primary" },
  interview: { label: "Interview", icon: Eye, color: "text-warning" },
  offer: { label: "Offer", icon: CheckCircle, color: "text-success" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-destructive" },
};
