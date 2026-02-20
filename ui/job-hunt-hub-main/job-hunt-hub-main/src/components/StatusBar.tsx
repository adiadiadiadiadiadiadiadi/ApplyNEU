import { tasks } from "@/data/tasks";

export function StatusBar() {
  const total = tasks.length;
  const segments = [
    { status: "offer", color: "bg-success", count: tasks.filter(t => t.status === "offer").length },
    { status: "interview", color: "bg-warning", count: tasks.filter(t => t.status === "interview").length },
    { status: "applied", color: "bg-primary", count: tasks.filter(t => t.status === "applied").length },
    { status: "pending", color: "bg-muted-foreground", count: tasks.filter(t => t.status === "pending").length },
    { status: "rejected", color: "bg-destructive", count: tasks.filter(t => t.status === "rejected").length },
  ];

  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((seg) => (
          <div
            key={seg.status}
            className={`${seg.color} transition-all duration-500`}
            style={{ width: `${(seg.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {segments.map((seg) => (
          <div key={seg.status} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${seg.color}`} />
            <span className="capitalize">{seg.status}</span>
            <span className="font-mono text-foreground">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
