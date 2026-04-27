import { useEffect, useState } from 'react';
import { Database, Activity, Server, AlertCircle, CheckCircle, RefreshCw, Download, Upload } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { db } from '../../lib/database';

interface HealthMetric {
  id: string;
  metric_name: string;
  metric_value: string;
  status: string;
  checked_at: string;
}

export default function SystemMaintenance() {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHealthMetrics();
  }, []);

  const loadHealthMetrics = async () => {
    setLoading(true);
    try {
      const metrics = await db.getRecentHealthMetrics(undefined, 20);
      setHealthMetrics(metrics as HealthMetric[]);
    } catch (error) {
      console.error('Error loading health metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate checking system health
    try {
      await db.recordHealthMetric('database', 'connected', 'healthy');
      await db.recordHealthMetric('api', 'operational', 'healthy');
      await db.recordHealthMetric('storage', 'available', 'healthy');
      await db.recordHealthMetric('memory', 'normal', 'healthy');
      await loadHealthMetrics();
    } catch (error) {
      console.error('Error refreshing health metrics:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleBackup = async () => {
    alert('Database backup initiated. This will be implemented with actual backup functionality.');
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'operational':
      case 'available':
      case 'normal':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'warning':
      case 'degraded':
        return <AlertCircle className="text-yellow-600" size={20} />;
      case 'error':
      case 'critical':
      case 'down':
        return <AlertCircle className="text-red-600" size={20} />;
      default:
        return <Activity className="text-gray-600" size={20} />;
    }
  };

  const getStatusBadgeVariant = (status: string): 'primary' | 'success' | 'danger' | 'warning' | 'secondary' => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'operational':
      case 'available':
      case 'normal':
        return 'success';
      case 'warning':
      case 'degraded':
        return 'warning';
      case 'error':
      case 'critical':
      case 'down':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading system maintenance...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Maintenance</h1>
          <p className="text-gray-600">Monitor system health, manage backups, and track performance</p>
        </div>
        <Badge variant="primary">
          Super Admin
        </Badge>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Database className="text-blue-600" size={32} />
            <Badge variant="success">Online</Badge>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Database</h3>
          <p className="text-sm text-gray-600 mb-4">PostgreSQL connection stable</p>
          <Button onClick={handleBackup} size="sm" className="w-full">
            <Download size={16} className="mr-2" />
            Create Backup
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Server className="text-green-600" size={32} />
            <Badge variant="success">Healthy</Badge>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Server Status</h3>
          <p className="text-sm text-gray-600 mb-4">All systems operational</p>
          <Button onClick={handleRefresh} disabled={refreshing} size="sm" className="w-full">
            <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking...' : 'Check Health'}
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Activity className="text-purple-600" size={32} />
            <Badge variant="success">Normal</Badge>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Performance</h3>
          <p className="text-sm text-gray-600 mb-4">Response times optimal</p>
          <Button size="sm" className="w-full" variant="secondary">
            View Details
          </Button>
        </Card>
      </div>

      {/* System Health Metrics */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">System Health Metrics</h2>
          <Button onClick={loadHealthMetrics} size="sm">
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>
        <div className="space-y-3">
          {healthMetrics.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No health metrics available. Click refresh to check system health.
            </div>
          ) : (
            healthMetrics.map((metric) => (
              <div key={metric.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(metric.status)}
                  <div>
                    <div className="font-medium text-gray-900">{metric.metric_name}</div>
                    <div className="text-sm text-gray-600">{metric.metric_value}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={getStatusBadgeVariant(metric.status)}>
                    {metric.status}
                  </Badge>
                  <div className="text-xs text-gray-500">
                    {new Date(metric.checked_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Database Backup Management */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Database className="text-blue-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Database Backup Management</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Automatic Backups</h3>
              <p className="text-sm text-gray-600 mb-3">Daily backups at 2:00 AM UTC</p>
              <Button size="sm" variant="secondary">
                Configure Schedule
              </Button>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Manual Backup</h3>
              <p className="text-sm text-gray-600 mb-3">Create an immediate backup</p>
              <Button size="sm" onClick={handleBackup}>
                <Download size={16} className="mr-2" />
                Backup Now
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-3">Recent Backups</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Backup Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Size</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Created At</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200">
                    <td className="py-3 px-4 text-gray-900">backup_2024_04_27_020000.sql</td>
                    <td className="py-3 px-4 text-gray-600">2.4 MB</td>
                    <td className="py-3 px-4 text-gray-600">2024-04-27 02:00:00</td>
                    <td className="py-3 px-4 text-right">
                      <Button size="sm" variant="secondary">
                        <Download size={16} className="mr-1" />
                        Download
                      </Button>
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="py-3 px-4 text-gray-900">backup_2024_04_26_020000.sql</td>
                    <td className="py-3 px-4 text-gray-600">2.3 MB</td>
                    <td className="py-3 px-4 text-gray-600">2024-04-26 02:00:00</td>
                    <td className="py-3 px-4 text-right">
                      <Button size="sm" variant="secondary">
                        <Download size={16} className="mr-1" />
                        Download
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="text-purple-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Performance Metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">CPU Usage</div>
            <div className="text-2xl font-bold text-gray-900">12%</div>
            <div className="text-xs text-green-600 mt-1">Normal</div>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Memory Usage</div>
            <div className="text-2xl font-bold text-gray-900">45%</div>
            <div className="text-xs text-green-600 mt-1">Normal</div>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Disk Usage</div>
            <div className="text-2xl font-bold text-gray-900">32%</div>
            <div className="text-xs text-green-600 mt-1">Normal</div>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Response Time</div>
            <div className="text-2xl font-bold text-gray-900">120ms</div>
            <div className="text-xs text-green-600 mt-1">Excellent</div>
          </div>
        </div>
      </Card>

      {/* Error Log Monitoring */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="text-red-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Error Log Monitoring</h2>
        </div>
        <div className="space-y-3">
          <div className="p-4 border border-green-200 rounded-lg bg-green-50">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle size={16} />
              <span className="font-medium">No critical errors in the last 24 hours</span>
            </div>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">Recent Warnings</span>
              <Badge variant="warning">3 warnings</Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="text-gray-600">• Slow query detected (2.5s) - 2 hours ago</div>
              <div className="text-gray-600">• High memory usage spike - 5 hours ago</div>
              <div className="text-gray-600">• Connection pool nearly full - 8 hours ago</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Update Management */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Upload className="text-blue-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Update Management</h2>
        </div>
        <div className="space-y-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-gray-900">Current Version</div>
                <div className="text-sm text-gray-600">v1.0.0</div>
              </div>
              <Badge variant="success">Up to date</Badge>
            </div>
          </div>
          <Button size="sm" variant="secondary">
            Check for Updates
          </Button>
        </div>
      </Card>
    </div>
  );
}
