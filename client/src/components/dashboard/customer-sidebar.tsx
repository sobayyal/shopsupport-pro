import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow, format } from 'date-fns';
import type { Customer } from '@/types';

interface CustomerSidebarProps {
  customer: Customer;
  isOpen: boolean;
  onClose: () => void;
}

export default function CustomerSidebar({ customer, isOpen, onClose }: CustomerSidebarProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'bg-emerald-100 text-emerald-700';
      case 'delivered': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div
      className={`fixed right-0 top-0 h-full w-80 bg-white border-l border-slate-200 transform transition-transform duration-300 z-50 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Customer Details</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <i className="fas fa-times"></i>
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-120px)]">
          {/* Customer Profile */}
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center text-white text-xl font-medium">
                {getInitials(customer.name)}
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{customer.name}</h4>
                <p className="text-sm text-slate-500">{customer.email}</p>
                {customer.phone && (
                  <p className="text-sm text-slate-500">{customer.phone}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Customer Since</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatDistanceToNow(new Date(customer.joinDate), { addSuffix: true })}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total Orders</p>
                <p className="text-sm font-medium text-slate-900">{customer.totalOrders}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total Spent</p>
                <p className="text-sm font-medium text-slate-900">${customer.totalSpent}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Avg Order</p>
                <p className="text-sm font-medium text-slate-900">
                  ${customer.totalOrders > 0 
                    ? (parseFloat(customer.totalSpent) / customer.totalOrders).toFixed(2)
                    : '0.00'
                  }
                </p>
              </div>
            </div>

            {customer.location && (
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <i className="fas fa-map-marker-alt"></i>
                <span>{customer.location}</span>
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-slate-900 mb-3">Recent Orders</h4>
            {customer.orders && customer.orders.length > 0 ? (
              <div className="space-y-3">
                {customer.orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-slate-900">#{order.orderNumber}</p>
                      <Badge variant="secondary" className={`text-xs ${getStatusColor(order.status)}`}>
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-1">
                      {order.items?.length || 0} item(s)
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(order.createdAt), 'MMM d, yyyy')} • ${order.totalPrice}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No orders found</p>
            )}
          </div>

          {/* Support History */}
          <div>
            <h4 className="text-sm font-medium text-slate-900 mb-3">Support History</h4>
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-slate-900">Current Conversation</p>
                  <span className="text-xs text-slate-500">Active</span>
                </div>
                <p className="text-sm text-slate-600">In progress</p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
