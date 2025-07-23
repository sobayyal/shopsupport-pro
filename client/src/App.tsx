import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, Route, Switch } from 'wouter';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { Toaster } from './components/BasicComponents';
import LoginPage from './pages/LoginPage';
import { 
  DashboardPage, 
  ConversationsPage, 
  ConversationDetailPage, 
  UsersPage, 
  SettingsPage 
} from './pages/BasicPages';
import { Layout, ProtectedRoute } from './components/BasicComponents';
import './globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          <Router>
            <Switch>
              <Route path="/login" component={LoginPage} />
              
              <ProtectedRoute>
                <Layout>
                  <Switch>
                    <Route path="/" component={DashboardPage} />
                    <Route path="/dashboard" component={DashboardPage} />
                    <Route path="/conversations" component={ConversationsPage} />
                    <Route path="/conversations/:id">
                      {params => <ConversationDetailPage conversationId={parseInt(params.id)} />}
                    </Route>
                    <Route path="/users" component={UsersPage} />
                    <Route path="/settings" component={SettingsPage} />
                    <Route>
                      <div className="flex items-center justify-center h-64">
                        <p className="text-gray-500">Page not found</p>
                      </div>
                    </Route>
                  </Switch>
                </Layout>
              </ProtectedRoute>
            </Switch>
          </Router>
          
          <Toaster />
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
