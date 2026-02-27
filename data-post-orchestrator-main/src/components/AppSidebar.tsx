import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { AccountMenu } from "@/components/AccountMenu";
import { useTenant, TenantContextType } from "@/hooks/useTenant";
import logoLamor from "@/assets/lamoria-logo.png";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Home,
  LayoutDashboard,
  Columns,
  Activity,
  Table,
  CalendarDays,
  MessageCircle,
  Database,
  Settings,
  ClipboardList,
  Share2,
  Users,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  permissionKey?: keyof TenantContextType['permissions'];
}

const crmItems: NavItem[] = [
  { label: "Dashboard", href: "/crm/dashboard", icon: LayoutDashboard, permissionKey: 'allowCrmAgendamentos' },
  { label: "Kanban de Ação", href: "/crm/kanban-acao", icon: Activity, permissionKey: 'allowCrmAgendamentos' },
  { label: "Kanban Geral", href: "/crm/kanban", icon: Columns, permissionKey: 'allowCrmAgendamentos' },
  { label: "Agendar", href: "/crm/agendar", icon: CalendarDays, permissionKey: 'allowCrmAgendamentos' },
  { label: "Tabela", href: "/crm/tabela", icon: Table, permissionKey: 'allowCrmAgendamentos' },
  { label: "Chat ao vivo", href: "/crm/chat-ao-vivo", icon: MessageCircle, permissionKey: 'allowCrmAgendamentos' },
];

const baseOperationsItems: NavItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Agendamentos", href: "/agendamentos", icon: CalendarDays, permissionKey: 'allowCrmAgendamentos' },
  { label: "Monitoramento", href: "/monitoramento", icon: ClipboardList, permissionKey: 'allowCrmAgendamentos' },
  { label: "Consultórios", href: "/consultorios", icon: ClipboardList, permissionKey: 'allowConsultorios' },
  { label: "Dados", href: "/dentistas", icon: Database },
  { label: "Disparos", href: "/disparos", icon: Share2, permissionKey: 'allowDisparosWhatsapp' },
  { label: "Configurações", href: "/admin", icon: Settings },
];

const isActivePath = (pathname: string, href: string) => {
  if (href === "/home") return pathname === "/home";
  if (href.startsWith("/crm")) return pathname.startsWith(href);
  return pathname === href;
};

export const AppSidebar = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const { usuario, permissions } = useTenant();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const showLabels = !isCollapsed;
  const isAdmin = useMemo(() => {
    if (usuario?.cargo) return usuario.cargo === "admin";
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("usuario") || "null");
        return stored?.cargo === "admin";
      } catch {
        return false;
      }
    }
    return false;
  }, [usuario?.cargo]);

  const groupedNav = useMemo(
    () => {
      const principalItems = [...baseOperationsItems];
      if (isAdmin) {
        principalItems.splice(4, 0, {
          label: "Usuários",
          href: "/usuarios",
          icon: Users,
        });
      }

      return [
        { title: "Principal", items: principalItems },
        { title: "CRM", items: crmItems },
      ];
    },
    [isAdmin]
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200/70 bg-white/95">
      <SidebarHeader className="pb-1">
        <div className="relative flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 shadow-sm">
          <div className={`flex items-center gap-2 transition-opacity ${isCollapsed ? "opacity-0" : "opacity-100"}`}>
            <span className="text-lg font-bold text-slate-800">Odontomanager</span>
            <span className="text-lg font-bold text-purple-600">Lamor</span>
            <span className="text-lg font-bold text-purple-600">IA</span>
          </div>
          <img
            src={logoLamor}
            alt="LamorIA"
            className={`absolute left-2 top-2 h-6 w-auto transition-all ${isCollapsed ? "opacity-100 -translate-x-[17%]" : "opacity-0 translate-x-0"}`}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groupedNav.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
              {section.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    {(() => {
                      const allowed = item.permissionKey ? permissions[item.permissionKey] : true;
                      const content = (
                        <div
                          className={`flex items-center ${showLabels ? 'gap-2' : 'justify-center'} ${allowed ? '' : 'pointer-events-none opacity-40'}`}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          <span className={showLabels ? 'truncate text-sm text-slate-700' : 'sr-only'}>{item.label}</span>
                          {item.badge !== undefined && showLabels && (
                            <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      );

                      if (!allowed) {
                        return (
                          <SidebarMenuButton isActive={false} className="text-slate-600" title={item.label}>
                            {content}
                          </SidebarMenuButton>
                        );
                      }

                      return (
                        <SidebarMenuButton
                          asChild
                          isActive={isActivePath(pathname, item.href)}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          <Link to={item.href} className="block w-full" title={item.label}>
                            {content}
                          </Link>
                        </SidebarMenuButton>
                      );
                    })()}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator className="my-2" />
      <SidebarFooter>
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-2 text-sm text-slate-600">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sessão</p>
          <AccountMenu compact />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
