import {
  Activity,
  BrainCircuit,
  Inbox,
  CircleDot,
  Target,
  LayoutDashboard,
  BookOpenText,
  DollarSign,
  History,
  Search,
  ShieldCheck,
  SquarePen,
  Network,
  Boxes,
  Repeat,
  GitBranch,
  Settings,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/lib/router";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarProducts } from "./SidebarProducts";
import { SidebarAgents } from "./SidebarAgents";
import { useDialogActions } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { heartbeatsApi } from "../api/heartbeats";
import { instanceSettingsApi } from "../api/instanceSettings";
import { financeApi } from "../api/finance";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";
import { SidebarCompanyMenu } from "./SidebarCompanyMenu";
import { useLanguage } from "../context/LanguageContext";

export function Sidebar() {
  const { openNewIssue } = useDialogActions();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { t } = useLanguage();
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const { data: financeStatus } = useQuery({
    queryKey: queryKeys.finance.status,
    queryFn: () => financeApi.status(),
    retry: false,
    staleTime: 30_000,
  });
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const liveRunCount = liveRuns?.length ?? 0;
  const showWorkspacesLink = experimentalSettings?.enableIsolatedWorkspaces === true;

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };
  const financeEnabled = financeStatus?.enabled === true;

  if (financeEnabled) {
    return (
      <aside className="flex h-full min-h-0 w-full flex-col border-r border-border bg-background">
        <div className="flex h-12 shrink-0 items-center gap-1 px-3">
          <SidebarCompanyMenu />
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            aria-label={t("Search")}
            title={t("Search")}
          >
            <NavLink to="/search">
              <Search className="h-4 w-4" />
            </NavLink>
          </Button>
        </div>

        <nav className="scrollbar-auto-hide flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-2">
          <div className="flex flex-col gap-0.5">
            <SidebarNavItem to="/finance" label={t("Decision Workbench")} icon={BrainCircuit} liveCount={liveRunCount} />
            <SidebarNavItem to="/credit-risk" label="信用风控" icon={ShieldCheck} />
            <SidebarNavItem to="/issues" label={t("Decision History")} icon={CircleDot} />
            <SidebarNavItem to="/agents/all" label={t("Agents")} icon={Users} />
            <SidebarNavItem
              to="/inbox"
              label={t("Inbox")}
              icon={Inbox}
              badge={inboxBadge.inbox}
              badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
              alert={inboxBadge.failedRuns > 0}
            />
            <PluginSlotOutlet
              slotTypes={["sidebar"]}
              context={pluginContext}
              className="flex flex-col gap-0.5"
              itemClassName="text-[13px] font-medium"
              missingBehavior="placeholder"
            />
          </div>

          <SidebarSection label={t("Capabilities")}>
            <SidebarNavItem to="/skills" label={t("Skills")} icon={Boxes} />
            <SidebarNavItem to="/knowledge" label={t("Knowledge")} icon={BookOpenText} />
          </SidebarSection>

          <SidebarSection label={t("Account")}>
            <SidebarNavItem to="/company/settings" label={t("Settings")} icon={Settings} />
          </SidebarSection>

          <PluginSlotOutlet
            slotTypes={["sidebarPanel"]}
            context={pluginContext}
            className="flex flex-col gap-3"
            itemClassName="rounded-lg border border-border p-3"
            missingBehavior="placeholder"
          />
        </nav>
      </aside>
    );
  }

  return (
    <aside className="w-full h-full min-h-0 border-r border-border bg-background flex flex-col">
      {/* Top bar: Company name (bold) + Search — aligned with top sections (no visible border) */}
      <div className="flex items-center gap-1 px-3 h-12 shrink-0">
        <SidebarCompanyMenu />
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          aria-label={t("Search")}
          title={t("Search")}
        >
          <NavLink to="/search">
            <Search className="h-4 w-4" />
          </NavLink>
        </Button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          {/* New Issue button aligned with nav items */}
          <button
            onClick={() => openNewIssue()}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <SquarePen className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("New Issue")}</span>
          </button>
          <SidebarNavItem to="/dashboard" label={t("Dashboard")} icon={LayoutDashboard} liveCount={liveRunCount} />
          <SidebarNavItem
            to="/inbox"
            label={t("Inbox")}
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          <PluginSlotOutlet
            slotTypes={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-[13px] font-medium"
            missingBehavior="placeholder"
          />
        </div>

        <SidebarSection label={t("Work")}>
          <SidebarNavItem to="/finance" label={t("Decision Workbench")} icon={BrainCircuit} />
          <SidebarNavItem to="/issues" label={t("Issues")} icon={CircleDot} />
          <SidebarNavItem to="/monitoring" label={t("Monitoring")} icon={Activity} />
          <SidebarNavItem to="/routines" label={t("Routines")} icon={Repeat} />
          <SidebarNavItem to="/goals" label={t("Goals")} icon={Target} />
          {showWorkspacesLink ? (
            <SidebarNavItem to="/workspaces" label={t("Workspaces")} icon={GitBranch} />
          ) : null}
        </SidebarSection>

        <SidebarProjects />
        <SidebarProducts />

        <SidebarAgents />

        <SidebarSection label={t("Company")}>
          <SidebarNavItem to="/org" label={t("Org")} icon={Network} />
          <SidebarNavItem to="/skills" label={t("Skills")} icon={Boxes} />
          <SidebarNavItem to="/knowledge" label={t("Knowledge")} icon={BookOpenText} />
          <SidebarNavItem to="/costs" label={t("Costs")} icon={DollarSign} />
          <SidebarNavItem to="/activity" label={t("Activity")} icon={History} />
          <SidebarNavItem to="/company/settings" label={t("Settings")} icon={Settings} />
        </SidebarSection>

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
