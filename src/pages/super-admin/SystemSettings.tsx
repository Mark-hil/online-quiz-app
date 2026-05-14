import { useState } from 'react';
import { Settings, Shield, Bell, Database, Save } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    siteName: 'Quiz Management System',
    siteEmail: 'admin@quizsystem.com',
    maxQuizDuration: 180,
    allowStudentRegistration: true,
    requireEmailVerification: false,
    enableNotifications: true,
    maintenanceMode: false,
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    // Simulate saving settings
    setTimeout(() => {
      setLoading(false);
      alert('Settings saved successfully');
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600">Configure system-wide settings and preferences</p>
        </div>
        <Badge variant="primary">
          Super Admin
        </Badge>
      </div>

      {/* General Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="text-blue-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Site Name
            </label>
            <Input
              value={settings.siteName}
              onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              placeholder="Enter site name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Site Email
            </label>
            <Input
              type="email"
              value={settings.siteEmail}
              onChange={(e) => setSettings({ ...settings, siteEmail: e.target.value })}
              placeholder="admin@quizsystem.com"
            />
          </div>
        </div>
      </Card>

      {/* Security Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="text-green-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Allow Student Registration
              </label>
              <p className="text-xs text-gray-500">
                Students can create their own accounts
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.allowStudentRegistration}
              onChange={(e) => setSettings({ ...settings, allowStudentRegistration: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Require Email Verification
              </label>
              <p className="text-xs text-gray-500">
                Users must verify their email before accessing the system
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.requireEmailVerification}
              onChange={(e) => setSettings({ ...settings, requireEmailVerification: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        </div>
      </Card>

      {/* Quiz Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Database className="text-purple-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Quiz Settings</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Quiz Duration (minutes)
            </label>
            <Input
              type="number"
              value={settings.maxQuizDuration}
              onChange={(e) => setSettings({ ...settings, maxQuizDuration: parseInt(e.target.value) || 180 })}
              min="30"
              max="480"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum allowed duration for any quiz (30-480 minutes)
            </p>
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="text-orange-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Enable Email Notifications
              </label>
              <p className="text-xs text-gray-500">
                Send email notifications for important events
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.enableNotifications}
              onChange={(e) => setSettings({ ...settings, enableNotifications: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        </div>
      </Card>

      {/* System Maintenance */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="text-red-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">System Maintenance</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
            <div>
              <label className="text-sm font-medium text-gray-900">
                Maintenance Mode
              </label>
              <p className="text-xs text-gray-600">
                When enabled, only super admins can access the system
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading} className="flex items-center gap-2">
          <Save size={18} />
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
