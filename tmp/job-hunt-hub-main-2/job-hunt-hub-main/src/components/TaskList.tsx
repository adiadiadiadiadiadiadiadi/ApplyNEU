import { useState } from "react";
import { tasks, statusConfig, type TaskItem } from "@/data/tasks";

function TaskRow({ task }: { task: TaskItem }) {
  const [hovered, setHovered] = useState(false);
  const config = statusConfig[task.status];
  const Icon = config.icon;

  return (
    <div
      className="group relative rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:bg-secondary/50 cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{task.title}</p>
            <p className="text-sm text-muted-foreground">{task.company}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-mono uppercase tracking-wider ${config.color}`}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground font-mono">{task.date}</span>
        </div>
      </div>

      {/* Hover description */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          hovered ? "max-h-20 opacity-100 mt-3" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <p className="text-sm text-muted-foreground border-t border-border pt-3">
          {task.description}
        </p>
      </div>
    </div>
  );
}

export function TaskList() {
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </div>
  );
}
