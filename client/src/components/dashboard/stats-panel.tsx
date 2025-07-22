import type { DashboardStats } from '@/types';

interface StatsPanelProps {
  stats?: DashboardStats;
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  const statItems = [
    {
      label: 'Active Chats',
      value: stats?.activeChats || 0,
      icon: 'fas fa-comment-dots',
      color: 'text-primary'
    },
    {
      label: 'Avg Response',
      value: stats?.avgResponseTime || '0m',
      icon: 'fas fa-clock',
      color: 'text-emerald-500'
    },
    {
      label: 'Satisfaction',
      value: stats?.satisfaction || '0%',
      icon: 'fas fa-smile',
      color: 'text-amber-500'
    },
    {
      label: 'Resolved Today',
      value: stats?.resolvedToday || 0,
      icon: 'fas fa-check-circle',
      color: 'text-emerald-500'
    },
  ];

  return (
    <div className="p-6 bg-white border-b border-slate-100">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Today's Overview</h3>
      <div className="grid grid-cols-2 gap-4">
        {statItems.map((item, index) => (
          <div key={index} className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="text-sm text-slate-500">{item.label}</p>
              </div>
              <i className={`${item.icon} ${item.color} text-xl`}></i>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
