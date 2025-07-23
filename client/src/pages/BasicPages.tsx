import React from 'react';

export function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-800">Active Chats</h3>
          <p className="text-3xl font-bold text-blue-600">12</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-800">Waiting</h3>
          <p className="text-3xl font-bold text-yellow-600">3</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-800">Resolved Today</h3>
          <p className="text-3xl font-bold text-green-600">24</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-800">Online Agents</h3>
          <p className="text-3xl font-bold text-purple-600">5</p>
        </div>
      </div>
    </div>
  );
}

export function ConversationsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Conversations</h1>
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Active Conversations</h2>
        </div>
        <div className="p-4">
          <p className="text-gray-500">No conversations available. The chat widget will create conversations when customers start chatting.</p>
        </div>
      </div>
    </div>
  );
}

export function ConversationDetailPage({ conversationId }: { conversationId: number }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Conversation #{conversationId}</h1>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-gray-500">Conversation details will appear here.</p>
      </div>
    </div>
  );
}

export function UsersPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Team Members</h2>
        </div>
        <div className="p-4">
          <p className="text-gray-500">User management interface will be available here.</p>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">System Configuration</h2>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Shopify Integration</h3>
            <p className="text-gray-600">Configure your Shopify store connection and webhook settings.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">AI Settings</h3>
            <p className="text-gray-600">Customize AI response behavior and auto-response settings.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Notifications</h3>
            <p className="text-gray-600">Manage email and in-app notification preferences.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
