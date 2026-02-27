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
import {
  Home,
  LayoutDashboard,
  Columns,
  Activity,
  Table,
  CalendarDays,
  MessageCircle,
  Users,
  Database,
  Building2,
  Settings,
  ClipboardList,
  Share2,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

const crmItems: NavItem[] = [
  { label: "Dashboard", href: "/crm/dashboard", icon: LayoutDashboard },
  { label: "Kanban de Ação", href: "/crm/kanban-acao", icon: Activity },
  { label: "Kanban Geral", href: "/crm/kanban", icon: Columns },
  { label: "Agendar", href: "/crm/agendar", icon: CalendarDays },
  { label: "Tabela", href: "/crm/tabela", icon: Table },
  { label: "Chat ao vivo", href: "/crm/chat-ao-vivo", icon: MessageCircle },
];

const operationsItems: NavItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Agendamentos", href: "/agendamentos", icon: CalendarDays },
  { label: "Monitoramento", href: "/monitoramento", icon: ClipboardList },
  { label: "Consultórios", href: "/consultorios", icon: Building2 },
  { label: "Dados", href: "/dentistas", icon: Database },
  { label: "Usuários", href: "/usuarios", icon: Users },
  { label: "Disparos", href: "/disparos", icon: Share2 },
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

  const groupedNav = useMemo(
    () => [
      { title: "Principal", items: operationsItems },
      { title: "CRM", items: crmItems },
    ],
    []
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200/70 bg-white/95">
      <SidebarHeader className="pb-1">
        <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 shadow-sm">
          <span className="text-lg font-bold text-slate-800">Odontomanager</span>
          <span className="text-lg font-bold text-purple-600">Lamor</span>
          <span className="text-lg font-bold text-purple-600">IA</span>
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
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, item.href)}
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <Link to={item.href} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
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
