import { tasks } from "@/data/tasks";

export function StatsGrid() {
  const total = tasks.length;
  const applied = tasks.filter(t => t.status === "applied").length;
  const interviews = tasks.filter(t => t.status === "interview").length;
  const offers = tasks.filter(t => t.status === "offer").length;
  const rejected = tasks.filter(t => t.status === "rejected").length;
  const responseRate = total > 0 ? Math.round(((interviews + offers + rejected) / total) * 100) : 0;

  const stats = [
    { label: "Total", value: total, accent: false },
    { label: "Applied", value: applied, accent: true },
    { label: "Interviews", value: interviews, accent: false },
    { label: "Offers", value: offers, accent: false },
    { label: "Rejected", value: rejected, accent: false },
    { label: "Response", value: `${responseRate}%`, accent: true },
  ];

  return (
    <div className="grid grid-cols-6 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30"
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
            {stat.label}
          </p>
          <p className={`text-xl font-bold leading-tight ${stat.accent ? "text-primary" : "text-foreground"}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
