import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Collapse, IconButton, Tooltip } from '@mui/material';
import {
  Activity,
  BarChart3,
  BedDouble,
  BookOpen,
  Building2,
  ChefHat,
  ChevronDown,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileText,
  Globe2,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  Star,
  Sun,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/src/components/ui/sheet';
import { FLOOR, FRONT, ROLE_LABELS, StaffRole, SUPER, useAdminAuth } from '@/src/context/AdminAuthContext';
import { useAppTheme } from '@/src/context/ThemeContext';
import { cn } from '@/src/lib/utils';
import { BrandLogo } from '@/src/components/BrandLogo';

interface NavItem {
  to: string;
  label: string;
  roles: StaffRole[];
  icon: React.ReactNode;
  end?: boolean;
}

const NAV_GROUPS: Array<{ group: string; links: NavItem[] }> = [
  {
    group: 'Operations',
    links: [
      { to: '/admin', label: 'Dashboard', roles: FRONT, icon: <LayoutDashboard className="h-4 w-4 shrink-0" />, end: true },
      { to: '/admin/reservations', label: 'Reservations', roles: FRONT, icon: <ClipboardList className="h-4 w-4 shrink-0" /> },
      { to: '/admin/payment-proofs', label: 'Payment Proofs', roles: FRONT, icon: <CreditCard className="h-4 w-4 shrink-0" /> },
      { to: '/admin/enquiries', label: 'Enquiries', roles: FRONT, icon: <MessageSquare className="h-4 w-4 shrink-0" /> },
      { to: '/admin/feedback', label: 'Guest Feedback', roles: FRONT, icon: <Star className="h-4 w-4 shrink-0" /> },
      { to: '/admin/whatsapp', label: 'WhatsApp Cloud API', roles: FRONT, icon: <MessageCircle className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    group: 'Restaurant',
    links: [
      { to: '/admin/restaurant', label: 'Overview', roles: FRONT, icon: <UtensilsCrossed className="h-4 w-4 shrink-0" />, end: true },
      { to: '/admin/restaurant/pos', label: 'POS / New Order', roles: FRONT, icon: <Receipt className="h-4 w-4 shrink-0" /> },
      { to: '/admin/restaurant/orders', label: 'All Orders', roles: FRONT, icon: <FileText className="h-4 w-4 shrink-0" /> },
      { to: '/admin/restaurant/kots', label: 'KOT Tickets', roles: FLOOR, icon: <ClipboardList className="h-4 w-4 shrink-0" /> },
      { to: '/admin/restaurant/kitchen', label: 'Kitchen Display', roles: FLOOR, icon: <ChefHat className="h-4 w-4 shrink-0" /> },
      { to: '/admin/restaurant/menu', label: 'Menu Management', roles: FRONT, icon: <BookOpen className="h-4 w-4 shrink-0" /> },
      { to: '/admin/restaurant/categories', label: 'Categories', roles: FRONT, icon: <UtensilsCrossed className="h-4 w-4 shrink-0" /> },
      { to: '/admin/restaurant/payments', label: 'Payments', roles: FRONT, icon: <CreditCard className="h-4 w-4 shrink-0" /> },
      { to: '/admin/restaurant/reports', label: 'Reports', roles: SUPER, icon: <BarChart3 className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    group: 'Property',
    links: [
      { to: '/admin/room-types', label: 'Room Types', roles: FRONT, icon: <Building2 className="h-4 w-4 shrink-0" /> },
      { to: '/admin/rooms', label: 'Rooms Inventory', roles: FRONT, icon: <BedDouble className="h-4 w-4 shrink-0" /> },
      { to: '/admin/ota-sync', label: 'OTA & Channel Sync', roles: FRONT, icon: <Globe2 className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    group: 'Website & Content',
    links: [
      { to: '/admin/blog', label: 'Journal & Blog', roles: SUPER, icon: <BookOpen className="h-4 w-4 shrink-0" /> },
      { to: '/admin/site', label: 'Content & Settings', roles: SUPER, icon: <Settings className="h-4 w-4 shrink-0" /> },
      { to: '/admin/insights', label: 'Web Insights', roles: SUPER, icon: <BarChart3 className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    group: 'System',
    links: [
      { to: '/admin/users', label: 'Staff Accounts', roles: SUPER, icon: <Users className="h-4 w-4 shrink-0" /> },
      { to: '/admin/system', label: 'System & Backups', roles: SUPER, icon: <Activity className="h-4 w-4 shrink-0" /> },
    ],
  },
];

export function AdminLayout({ children, title = 'Operations' }: { children: React.ReactNode; title?: string }) {
  const { user, logout, can } = useAdminAuth();
  const { mode, toggleTheme } = useAppTheme();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('oasis_admin_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Operations: true,
    Restaurant: true,
    Property: true,
    'Website & Content': true,
    System: true,
  });

  const isWide = ['/admin/restaurant/pos', '/admin/restaurant/kitchen'].includes(pathname);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('oasis_admin_sidebar_collapsed', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleGroup(groupName: string) {
    setOpenGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  }

  const renderSidebarContent = (isCompactRail: boolean) => (
    <div className="flex h-full flex-col justify-between bg-[#0f1a2e] text-slate-100">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Sidebar Header / Brand + Collapse Toggle */}
        <div
          className={cn(
            'flex h-14 items-center border-b border-white/10',
            isCompactRail ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          {!isCompactRail && (
            <Link to="/admin" className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-85">
              <BrandLogo variant="dark-surface" className="h-9 w-auto shrink-0" />
              <span className="font-display truncate text-lg font-semibold tracking-tight text-white">
                Oasis Resort
              </span>
            </Link>
          )}
          <Tooltip title={isCompactRail ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
            <IconButton
              size="small"
              aria-label={isCompactRail ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={toggleSidebar}
              className="hidden md:inline-flex"
              sx={{
                width: 34,
                height: 34,
                color: 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                '&:hover': {
                  color: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              {isCompactRail ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </IconButton>
          </Tooltip>
        </div>

        {/* Collapsible Grouped Sidebar Navigation */}
        <nav
          aria-label="Admin sidebar navigation"
          className={cn('flex-1 space-y-3 overflow-y-auto py-3', isCompactRail ? 'px-2' : 'px-3')}
        >
          {NAV_GROUPS.map((section) => {
            const visible = section.links.filter((l) => can(...l.roles));
            if (!visible.length) return null;
            const groupExpanded = isCompactRail || openGroups[section.group] !== false;

            return (
              <div key={section.group} className="space-y-1">
                {!isCompactRail ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(section.group)}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50 transition-colors hover:bg-white/5 hover:text-white/80 cursor-pointer"
                  >
                    <span>{section.group}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-200',
                        groupExpanded ? 'rotate-0' : '-rotate-90',
                      )}
                    />
                  </button>
                ) : (
                  <div className="mx-auto my-2 h-px w-6 bg-white/10" aria-hidden="true" />
                )}

                <Collapse in={groupExpanded} timeout={200} unmountOnExit={false}>
                  <div className="space-y-0.5">
                    {visible.map((link) => {
                      const navLink = (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          end={link.end}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'group relative flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                              isCompactRail ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2',
                              isActive
                                ? 'bg-accent text-white shadow-sm'
                                : 'text-slate-300 hover:bg-white/10 hover:text-white',
                            )
                          }
                        >
                          {link.icon}
                          {!isCompactRail && <span className="truncate">{link.label}</span>}
                        </NavLink>
                      );

                      return isCompactRail ? (
                        <Tooltip key={link.to} title={link.label} placement="right" arrow>
                          <div>{navLink}</div>
                        </Tooltip>
                      ) : (
                        navLink
                      );
                    })}
                  </div>
                </Collapse>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer / Staff Profile & Quick Actions */}
      <div className={cn('border-t border-white/10 space-y-3', isCompactRail ? 'p-2.5' : 'p-4')}>
        {!isCompactRail && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="text-xs text-white/60">{user ? ROLE_LABELS[user.role] || user.role : ''}</p>
          </div>
        )}
        <div className={cn('flex items-center gap-2', isCompactRail && 'flex-col')}>
          <Tooltip title="Public Website" placement={isCompactRail ? 'right' : 'top'}>
            <span className={cn(!isCompactRail && 'flex flex-1')}>
              <Button
                asChild
                variant="outline"
                size={isCompactRail ? 'icon' : 'sm'}
                className={cn(
                  'border-white/20 bg-transparent text-white hover:bg-white/10',
                  !isCompactRail ? 'w-full' : 'h-9 w-9',
                )}
              >
                <Link to="/" aria-label="Public Website">
                  <Home className="h-3.5 w-3.5" />
                  {!isCompactRail && <span>Website</span>}
                </Link>
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Sign Out" placement={isCompactRail ? 'right' : 'top'}>
            <span>
              <Button
                type="button"
                variant="outline"
                size={isCompactRail ? 'icon' : 'sm'}
                aria-label="Sign Out"
                onClick={logout}
                className={cn(
                  'border-white/20 bg-transparent text-white hover:bg-white/10',
                  isCompactRail && 'h-9 w-9',
                )}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative z-10 flex min-h-screen text-foreground">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 border-r border-border transition-[width] duration-200 ease-out md:block',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        {renderSidebarContent(collapsed)}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-card px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden h-9 w-9" aria-label="Menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 border-r-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Admin Navigation</SheetTitle>
                </SheetHeader>
                {renderSidebarContent(false)}
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-muted-foreground hidden sm:inline">Oasis Staff Desk</span>
              <span className="text-muted-foreground hidden sm:inline">/</span>
              <span className="font-semibold text-foreground truncate">{title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
              {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden sm:inline">{mode === 'dark' ? 'Light' : 'Dark'}</span>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/" target="_blank">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Public Site</span>
              </Link>
            </Button>
          </div>
        </header>

        <main className={cn('flex-1', isWide ? 'p-4 md:p-6' : 'mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8')}>
          {children}
        </main>
      </div>
    </div>
  );
}
