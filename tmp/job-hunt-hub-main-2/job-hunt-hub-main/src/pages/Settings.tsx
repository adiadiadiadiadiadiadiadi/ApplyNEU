import { useState } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";

const Settings = () => {
  const navigate = useNavigate();
  const [waitForApproval, setWaitForApproval] = useState(false);
  const [recentJobs, setRecentJobs] = useState(false);
  const [branchPrefix, setBranchPrefix] = useState(false);
  const [sensitivity, setSensitivity] = useState<"L" | "M" | "H">("M");

  return (
    <div className="h-screen w-screen bg-background text-foreground overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-6">
          <h1 className="text-base font-semibold tracking-tight">Job Tracker</h1>
          <nav className="flex items-center gap-1">
            <NavLink to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1">Dashboard</NavLink>
            <NavLink to="/metrics" className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1">Metrics</NavLink>
            <NavLink to="/settings" activeClassName="text-primary" className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1">Settings</NavLink>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-8 max-w-3xl mx-auto w-full">
        <h2 className="text-2xl font-bold tracking-tight mb-6">settings</h2>

        {/* Profile Settings Card */}
        <Card
          className="mb-6 cursor-pointer group hover:border-primary/40 transition-colors"
          onClick={() => {}}
        >
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm font-semibold text-foreground">profile settings</p>
              <p className="text-xs text-muted-foreground mt-0.5">view and edit account details</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardContent>
        </Card>

        {/* Preferences Card */}
        <Card>
          <CardContent className="p-5 space-y-0">
            <p className="text-sm font-semibold text-muted-foreground mb-4">Preferences</p>

            {/* Wait for approval */}
            <div className="flex items-center justify-between py-4 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">wait for approval</p>
                <p className="text-xs text-muted-foreground mt-0.5">wait for user approval before applying to a job</p>
              </div>
              <Switch checked={waitForApproval} onCheckedChange={setWaitForApproval} />
            </div>

            {/* Recent jobs */}
            <div className="flex items-center justify-between py-4 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">recent jobs</p>
                <p className="text-xs text-muted-foreground mt-0.5">apply only to jobs posted in the last week</p>
              </div>
              <Switch checked={recentJobs} onCheckedChange={setRecentJobs} />
            </div>

            {/* Job match sensitivity */}
            <div className="flex items-center justify-between py-4 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">job match sensitivity</p>
                <p className="text-xs text-muted-foreground mt-0.5">how strict LLMs are when matching you to jobs</p>
              </div>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(["L", "M", "H"] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setSensitivity(level)}
                    className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                      sensitivity === level
                        ? "bg-primary/20 text-primary border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Branch prefix */}
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">branch prefix</p>
                <p className="text-xs text-muted-foreground mt-0.5">toggle branch prefix usage</p>
              </div>
              <Switch checked={branchPrefix} onCheckedChange={setBranchPrefix} />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
