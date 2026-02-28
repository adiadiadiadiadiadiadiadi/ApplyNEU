import { useState } from "react";
import { Check } from "lucide-react";
import { todoTasks, type TodoTask } from "@/data/todos";

function TodoRow({ task, onToggle }: { task: TodoTask; onToggle: () => void }) {
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-secondary/50 cursor-default">
      <button
        onClick={onToggle}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          task.done
            ? "border-primary bg-primary"
            : "border-muted-foreground/40 hover:border-primary"
        }`}
      >
        {task.done && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
      </button>
      <span
        className={`text-sm leading-tight transition-colors ${
          task.done ? "text-muted-foreground line-through" : "text-foreground"
        }`}
      >
        {task.label}
      </span>
    </div>
  );
}

export function TodoList() {
  const [tasks, setTasks] = useState<TodoTask[]>(todoTasks);

  const toggle = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const remaining = tasks.filter((t) => !t.done).length;

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2 px-3 font-mono">
        {remaining} remaining
      </p>
      <div className="space-y-0.5">
        {tasks.map((task) => (
          <TodoRow key={task.id} task={task} onToggle={() => toggle(task.id)} />
        ))}
      </div>
    </div>
  );
}
