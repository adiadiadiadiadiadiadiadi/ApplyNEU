import { tasks } from "@/data/tasks";
import { todoTasks } from "@/data/todos";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, TrendingUp, BarChart3, PieChart, Target, Calendar, Clock, Zap, Award } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell,
  AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

const statusColors: Record<string, string> = {
  applied: "hsl(175, 80%, 50%)",
  interview: "hsl(40, 90%, 55%)",
  offer: "hsl(145, 60%, 45%)",
  rejected: "hsl(0, 70%, 55%)",
  pending: "hsl(0, 0%, 50%)",
};

const tooltipStyle = {
  contentStyle: { background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)", borderRadius: "8px", fontSize: "12px" },
  itemStyle: { color: "hsl(0 0% 95%)" },
};

export default function Metrics() {
  const navigate = useNavigate();

  const total = tasks.length;
  const applied = tasks.filter((t) => t.status === "applied").length;
  const interviews = tasks.filter((t) => t.status === "interview").length;
  const offers = tasks.filter((t) => t.status === "offer").length;
  const rejected = tasks.filter((t) => t.status === "rejected").length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const todosRemaining = todoTasks.filter((t) => !t.done).length;
  const todosDone = todoTasks.filter((t) => t.done).length;
  const responseRate = total > 0 ? Math.round(((interviews + offers + rejected) / total) * 100) : 0;

  const pieData = [
    { name: "Applied", value: applied },
    { name: "Interview", value: interviews },
    { name: "Offer", value: offers },
    { name: "Rejected", value: rejected },
    { name: "Pending", value: pending },
  ].filter((d) => d.value > 0);

  const weeklyData = [
    { week: "W1", applications: 2, responses: 1 },
    { week: "W2", applications: 3, responses: 1 },
    { week: "W3", applications: 1, responses: 2 },
    { week: "W4", applications: 2, responses: 0 },
  ];

  const statusBarData = [
    { status: "Applied", count: applied },
    { status: "Interview", count: interviews },
    { status: "Offer", count: offers },
    { status: "Rejected", count: rejected },
    { status: "Pending", count: pending },
  ];

  const radarData = [
    { skill: "Frontend", score: 90 },
    { skill: "Backend", score: 60 },
    { skill: "DevOps", score: 40 },
    { skill: "Design", score: 70 },
    { skill: "Mobile", score: 35 },
    { skill: "Data", score: 50 },
  ];

  const companyData = [
    { company: "Stripe", count: 1 },
    { company: "Vercel", count: 1 },
    { company: "Linear", count: 1 },
    { company: "Figma", count: 1 },
    { company: "Notion", count: 1 },
    { company: "Datadog", count: 1 },
    { company: "Shopify", count: 1 },
    { company: "GitHub", count: 1 },
  ];

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border bg-card/50 px-6 py-3">
        <div className="mx-auto max-w-[1200px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:border-primary/30 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <h1 className="text-sm font-bold text-foreground tracking-tight">Metrics</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <BarChart3 className="h-3 w-3 text-primary" />
            <span>Analytics</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="mx-auto max-w-[1200px] px-6 py-4 h-full flex flex-col gap-3">
          {/* Profile card + quick stats */}
          <div className="shrink-0 grid grid-cols-6 gap-3">
            <div className="col-span-2 rounded-lg border border-border bg-card p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground truncate">Alex Johnson</h2>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">alex.johnson@email.com</span>
                </div>
              </div>
            </div>
            {[
              { label: "Applications", value: total, icon: Calendar, accent: false },
              { label: "Response Rate", value: `${responseRate}%`, icon: Zap, accent: true },
              { label: "Tasks Done", value: `${todosDone}/${todosDone + todosRemaining}`, icon: Award, accent: false },
              { label: "Avg. Response", value: "3.2d", icon: Clock, accent: true },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card px-3 py-3 flex items-center gap-2.5">
                <s.icon className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{s.label}</p>
                  <p className={`text-lg font-bold leading-tight ${s.accent ? "text-primary" : "text-foreground"}`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main charts — 2 rows filling remaining space */}
          <div className="flex-1 min-h-0 grid grid-rows-2 gap-3">
            {/* Row 1: 3 charts */}
            <div className="grid grid-cols-3 gap-3 min-h-0">
              {/* Pie */}
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <PieChart className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Status Breakdown</h3>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius="40%" outerRadius="65%" dataKey="value" stroke="none">
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={statusColors[entry.name.toLowerCase()] || statusColors.pending} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-1 justify-center shrink-0">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <div className="h-2 w-2 rounded-full" style={{ background: statusColors[d.name.toLowerCase()] }} />
                      <span>{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar */}
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">By Status</h3>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusBarData} barSize={24}>
                      <XAxis dataKey="status" tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(0 0% 10%)" }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {statusBarData.map((entry) => (
                          <Cell key={entry.status} fill={statusColors[entry.status.toLowerCase()] || statusColors.pending} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Radar — skill focus */}
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Role Focus</h3>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="hsl(0 0% 14%)" />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }} />
                      <Radar dataKey="score" stroke="hsl(175, 80%, 50%)" fill="hsl(175, 80%, 50%)" fillOpacity={0.15} strokeWidth={2} />
                      <Tooltip {...tooltipStyle} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Row 2: activity + companies + funnel */}
            <div className="grid grid-cols-3 gap-3 min-h-0">
              {/* Weekly activity */}
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Weekly Activity</h3>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyData}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(175, 80%, 50%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(175, 80%, 50%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(40, 90%, 55%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(40, 90%, 55%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...tooltipStyle} />
                      <Area type="monotone" dataKey="applications" stroke="hsl(175, 80%, 50%)" fill="url(#areaGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="responses" stroke="hsl(40, 90%, 55%)" fill="url(#areaGrad2)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Companies bar */}
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">By Company</h3>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={companyData} layout="vertical" barSize={14}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="company" tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }} axisLine={false} tickLine={false} width={55} />
                      <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(0 0% 10%)" }} />
                      <Bar dataKey="count" fill="hsl(175, 80%, 50%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Funnel conversion cards */}
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-3 shrink-0">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Conversion Funnel</h3>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-2">
                  {[
                    { label: "Apply → Response", value: `${responseRate}%`, width: responseRate },
                    { label: "Response → Interview", value: interviews > 0 ? `${Math.round((interviews / (interviews + rejected)) * 100)}%` : "—", width: interviews > 0 ? Math.round((interviews / (interviews + rejected)) * 100) : 0 },
                    { label: "Interview → Offer", value: interviews > 0 ? `${Math.round((offers / (interviews + offers)) * 100)}%` : "—", width: interviews > 0 ? Math.round((offers / (interviews + offers)) * 100) : 0 },
                    { label: "Overall Success", value: total > 0 ? `${Math.round((offers / total) * 100)}%` : "—", width: total > 0 ? Math.round((offers / total) * 100) : 0 },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{m.label}</span>
                        <span className="text-xs font-bold text-foreground font-mono">{m.value}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.max(m.width, 3)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
