import { StatsGrid } from "@/components/StatsGrid";
import { StatusBar } from "@/components/StatusBar";
import { TaskList } from "@/components/TaskList";
import { TodoList } from "@/components/TodoList";
import { Briefcase, Activity, BarChart3, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border bg-card/50 px-6 py-3">
        <div className="mx-auto max-w-[1200px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
              <Briefcase className="h-3.5 w-3.5 text-primary" />
            </div>
            <h1 className="text-sm font-bold text-foreground tracking-tight">Job Tracker</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Activity className="h-3 w-3 text-primary" />
              <span>Dashboard</span>
            </div>
            <button
              onClick={() => navigate("/metrics")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono hover:text-primary transition-colors"
            >
              <BarChart3 className="h-3 w-3" />
              <span>Metrics</span>
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono hover:text-primary transition-colors"
            >
              <Settings className="h-3 w-3" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="mx-auto max-w-[1200px] px-6 py-4 h-full flex flex-col gap-3">
          {/* Stats row */}
          <div className="shrink-0">
            <StatsGrid />
          </div>

          {/* Two-column dashboard grid */}
          <div className="flex-1 min-h-0 grid grid-cols-5 gap-3">
            {/* Left column — Tasks & Pipeline */}
            <div className="col-span-2 flex flex-col gap-3 min-h-0">
              {/* Pipeline panel */}
              <div className="shrink-0 rounded-lg border border-border bg-card p-4">
                <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
                  Pipeline
                </h2>
                <StatusBar />
              </div>

              {/* Tasks panel */}
              <div className="flex-1 min-h-0 rounded-lg border border-border bg-card p-4 flex flex-col">
                <div className="shrink-0 mb-3">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Action Items
                  </h2>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                  <TodoList />
                </div>
              </div>
            </div>

            {/* Right column — Applications */}
            <div className="col-span-3 min-h-0 rounded-lg border border-border bg-card p-4 flex flex-col">
              <div className="shrink-0 mb-3 flex items-center justify-between">
                <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Applications
                </h2>
                <span className="text-xs font-mono text-muted-foreground">8 total</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <TaskList />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
