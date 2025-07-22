import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { User, DashboardStats } from '@/types';

interface HeaderProps {
  user: User;
  stats?: DashboardStats;
}

export default function Header({ user, stats }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  const handleStatusToggle = () => {
    setIsOnline(!isOnline);
    // TODO: Update user status via API
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">
            Welcome back, {user.username}! You have {stats?.activeChats || 0} active conversations.
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-80 pl-10"
            />
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
          </div>
          
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <i className="fas fa-bell text-lg"></i>
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 px-1 min-w-[20px] h-5 text-xs"
            >
              5
            </Badge>
          </Button>

          {/* Status Toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">Status:</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStatusToggle}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                isOnline
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full mr-2 ${
                isOnline ? 'bg-emerald-500' : 'bg-slate-500'
              }`}></span>
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
