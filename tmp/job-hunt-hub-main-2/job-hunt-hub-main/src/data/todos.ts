export interface TodoTask {
  id: string;
  label: string;
  description: string;
  done: boolean;
}

export const todoTasks: TodoTask[] = [
  { id: "t1", label: "Apply through CrowdStrike careers portal", description: "Submit resume and cover letter via their Workday portal. Position: Security Engineer.", done: false },
  { id: "t2", label: "Apply through SEL careers portal", description: "Complete application on SEL website. Attach references and transcripts.", done: false },
  { id: "t3", label: "Upload Yuzu Health cover letter", description: "Tailor cover letter for the Frontend role. Mention telehealth experience.", done: false },
  { id: "t4", label: "Apply through CNH careers portal", description: "Fill out CNH Industrial application. Position: Software Developer II.", done: false },
  { id: "t5", label: "Apply through Priceline careers portal", description: "Submit via Priceline jobs page. Highlight travel-tech and React experience.", done: false },
];
