import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Activity, Clock, Search } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { db } from '../../lib/database';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
  name: string;
  email: string;
  role: string;
}

interface LoginAttempt {
  id: string;
  email: string;
  success: boolean;
  ip_address: string;
  user_agent: string;
  error_message: string;
  created_at: string;
}

export default function AuditLogs() {
  const [activeTab, setActiveTab] = useState<'activity' | 'login' | 'failed'>('activity');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<LoginAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'activity') {
        const logs = await db.getAuditLogs(100, 0);
        setAuditLogs(logs as AuditLog[]);
      } else if (activeTab === 'login') {
        const attempts = await db.getLoginAttempts(100, 0);
        setLoginAttempts(attempts as LoginAttempt[]);
      } else if (activeTab === 'failed') {
        const failed = await db.getFailedLoginAttempts(50);
        setFailedAttempts(failed as LoginAttempt[]);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeVariant = (action: string): 'primary' | 'success' | 'danger' | 'warning' | 'secondary' => {
    if (action.includes('delete') || action.includes('remove')) return 'danger';
    if (action.includes('create') || action.includes('add')) return 'success';
    if (action.includes('update') || action.includes('edit')) return 'warning';
    return 'secondary';
  };

  const filteredAuditLogs = auditLogs.filter(log =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLoginAttempts = loginAttempts.filter(attempt =>
    attempt.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFailedAttempts = failedAttempts.filter(attempt =>
    attempt.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-12">Loading audit logs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit & Security Logs</h1>
          <p className="text-gray-600">Monitor system activity, login attempts, and security events</p>
        </div>
        <Badge variant="primary">
          Super Admin
        </Badge>
      </div>

      {/* Tabs */}
      <Card className="p-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeTab === 'activity'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Activity size={18} />
            User Activity
          </button>
          <button
            onClick={() => setActiveTab('login')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeTab === 'login'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Shield size={18} />
            Login Attempts
          </button>
          <button
            onClick={() => setActiveTab('failed')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeTab === 'failed'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <AlertTriangle size={18} />
            Failed Logins
          </button>
        </div>
      </Card>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* User Activity Logs */}
      {activeTab === 'activity' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              User Activity Logs ({filteredAuditLogs.length})
            </h2>
            <Button onClick={loadData} size="sm">
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">User</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Action</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Entity</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">IP Address</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{log.name || 'System'}</div>
                          <div className="text-xs text-gray-500">{log.email || log.role}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {log.entity_type && (
                          <div>
                            <span className="font-medium">{log.entity_type}</span>
                            {log.entity_id && <span className="text-xs ml-1">({log.entity_id})</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{log.ip_address || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Login Attempts */}
      {activeTab === 'login' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Login Attempts ({filteredLoginAttempts.length})
            </h2>
            <Button onClick={loadData} size="sm">
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">IP Address</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Error</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoginAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No login attempts found
                    </td>
                  </tr>
                ) : (
                  filteredLoginAttempts.map((attempt) => (
                    <tr key={attempt.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{attempt.email}</td>
                      <td className="py-3 px-4">
                        <Badge variant={attempt.success ? 'success' : 'danger'}>
                          {attempt.success ? 'Success' : 'Failed'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{attempt.ip_address || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{attempt.error_message || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          {new Date(attempt.created_at).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Failed Login Attempts */}
      {activeTab === 'failed' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Failed Login Attempts ({filteredFailedAttempts.length})
            </h2>
            <Button onClick={loadData} size="sm">
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">IP Address</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Error</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredFailedAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      No failed login attempts found
                    </td>
                  </tr>
                ) : (
                  filteredFailedAttempts.map((attempt) => (
                    <tr key={attempt.id} className="border-b border-gray-100 hover:bg-red-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{attempt.email}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{attempt.ip_address || '-'}</td>
                      <td className="py-3 px-4 text-sm text-red-600">{attempt.error_message}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          {new Date(attempt.created_at).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
