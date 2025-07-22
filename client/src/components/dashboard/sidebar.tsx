import { Button } from '@/components/ui/button';
import type { User } from '@/types';

interface SidebarProps {
  user: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ user, activeTab, onTabChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-line', badge: null },
    { id: 'live-chat', label: 'Live Chat', icon: 'fas fa-comments', badge: 3 },
    { id: 'tickets', label: 'Tickets', icon: 'fas fa-ticket-alt', badge: 12 },
    { id: 'customers', label: 'Customers', icon: 'fas fa-users', badge: null },
    { id: 'ai-responses', label: 'AI Responses', icon: 'fas fa-robot', badge: null },
    { id: 'analytics', label: 'Analytics', icon: 'fas fa-chart-bar', badge: null },
  ];

  const adminItems = [
    { id: 'agents', label: 'Agents', icon: 'fas fa-user-tie', roles: ['admin'] },
    { id: 'settings', label: 'Settings', icon: 'fas fa-cog', roles: ['admin', 'manager'] },
  ];

  const isItemVisible = (roles?: string[]) => {
    if (!roles) return true;
    return roles.includes(user.role);
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo & Brand */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-headset text-white text-lg"></i>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">ShopSupport Pro</h1>
            <p className="text-xs text-slate-500">Customer Support Hub</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "default" : "ghost"}
              className={`w-full justify-start ${
                activeTab === item.id
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => onTabChange(item.id)}
            >
              <i className={`${item.icon} w-5 mr-3`}></i>
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Admin Section */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Administration
          </p>
          <div className="space-y-2">
            {adminItems.map((item) => 
              isItemVisible(item.roles) ? (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className={`w-full justify-start ${
                    activeTab === item.id
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  onClick={() => onTabChange(item.id)}
                >
                  <i className={`${item.icon} w-5 mr-3`}></i>
                  <span>{item.label}</span>
                </Button>
              ) : null
            )}
          </div>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user.username}</p>
            <p className="text-xs text-slate-500 capitalize">{user.role}</p>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            <span className="text-xs text-emerald-600">Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
