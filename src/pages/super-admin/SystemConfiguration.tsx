import { useState } from 'react';
import { Settings, Shield, Bell, Mail, Save, Lock } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';

export default function SystemConfiguration() {
  const [quizSettings, setQuizSettings] = useState({
    maxQuestionsPerQuiz: 100,
    maxDurationMinutes: 180,
    allowRandomization: true,
    allowNegativeMarking: false,
    defaultPassingScore: 60,
  });

  const [antiCheatSettings, setAntiCheatSettings] = useState({
    enableTabSwitchDetection: true,
    maxTabSwitches: 3,
    enableTimeTracking: true,
    enableIPAddressLogging: true,
    enableCameraMonitoring: false,
    enableScreenRecording: false,
  });

  const [rolePermissions, setRolePermissions] = useState({
    lecturer: {
      canCreateQuizzes: true,
      canEditQuizzes: true,
      canDeleteQuizzes: true,
      canViewResults: true,
      canExportResults: true,
    },
    moderator: {
      canApproveQuizzes: true,
      canRejectQuizzes: true,
      canViewAllQuizzes: true,
      canEditQuizzes: false,
    },
    admin: {
      canManageUsers: true,
      canViewSystemLogs: true,
      canConfigureSettings: true,
      canManageBackups: true,
    },
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    quizReminders: true,
    resultNotifications: true,
    systemAlerts: true,
  });

  const [emailSettings, setEmailSettings] = useState({
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpUser: '',
    smtpFrom: 'noreply@quizsystem.com',
    smtpSecure: true,
  });

  const handleSave = async (section: string) => {
    alert(`${section} settings saved successfully`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
          <p className="text-gray-600">Configure system-wide settings, permissions, and integrations</p>
        </div>
        <Badge variant="primary">
          Super Admin
        </Badge>
      </div>

      {/* Quiz Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="text-blue-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Quiz Settings</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Questions per Quiz
              </label>
              <Input
                type="number"
                value={quizSettings.maxQuestionsPerQuiz}
                onChange={(e) => setQuizSettings({ ...quizSettings, maxQuestionsPerQuiz: parseInt(e.target.value) || 100 })}
                min="1"
                max="500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Duration (minutes)
              </label>
              <Input
                type="number"
                value={quizSettings.maxDurationMinutes}
                onChange={(e) => setQuizSettings({ ...quizSettings, maxDurationMinutes: parseInt(e.target.value) || 180 })}
                min="5"
                max="480"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Passing Score (%)
              </label>
              <Input
                type="number"
                value={quizSettings.defaultPassingScore}
                onChange={(e) => setQuizSettings({ ...quizSettings, defaultPassingScore: parseInt(e.target.value) || 60 })}
                min="0"
                max="100"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Allow Question Randomization
              </label>
              <input
                type="checkbox"
                checked={quizSettings.allowRandomization}
                onChange={(e) => setQuizSettings({ ...quizSettings, allowRandomization: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Allow Negative Marking
              </label>
              <input
                type="checkbox"
                checked={quizSettings.allowNegativeMarking}
                onChange={(e) => setQuizSettings({ ...quizSettings, allowNegativeMarking: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => handleSave('Quiz')} className="flex items-center gap-2">
              <Save size={18} />
              Save Quiz Settings
            </Button>
          </div>
        </div>
      </Card>

      {/* Anti-Cheat Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="text-red-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Anti-Cheat Settings</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Tab Switches Allowed
              </label>
              <Input
                type="number"
                value={antiCheatSettings.maxTabSwitches}
                onChange={(e) => setAntiCheatSettings({ ...antiCheatSettings, maxTabSwitches: parseInt(e.target.value) || 3 })}
                min="0"
                max="10"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Enable Tab Switch Detection
                </label>
                <p className="text-xs text-gray-500">Detect when students switch tabs during quiz</p>
              </div>
              <input
                type="checkbox"
                checked={antiCheatSettings.enableTabSwitchDetection}
                onChange={(e) => setAntiCheatSettings({ ...antiCheatSettings, enableTabSwitchDetection: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Enable Time Tracking
                </label>
                <p className="text-xs text-gray-500">Track time spent on each question</p>
              </div>
              <input
                type="checkbox"
                checked={antiCheatSettings.enableTimeTracking}
                onChange={(e) => setAntiCheatSettings({ ...antiCheatSettings, enableTimeTracking: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Enable IP Address Logging
                </label>
                <p className="text-xs text-gray-500">Log IP addresses for audit trail</p>
              </div>
              <input
                type="checkbox"
                checked={antiCheatSettings.enableIPAddressLogging}
                onChange={(e) => setAntiCheatSettings({ ...antiCheatSettings, enableIPAddressLogging: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Enable Camera Monitoring (Proctoring)
                </label>
                <p className="text-xs text-gray-500">Use webcam to monitor students during quiz</p>
              </div>
              <input
                type="checkbox"
                checked={antiCheatSettings.enableCameraMonitoring}
                onChange={(e) => setAntiCheatSettings({ ...antiCheatSettings, enableCameraMonitoring: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Enable Screen Recording
                </label>
                <p className="text-xs text-gray-500">Record screen during quiz (requires consent)</p>
              </div>
              <input
                type="checkbox"
                checked={antiCheatSettings.enableScreenRecording}
                onChange={(e) => setAntiCheatSettings({ ...antiCheatSettings, enableScreenRecording: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => handleSave('Anti-Cheat')} className="flex items-center gap-2">
              <Save size={18} />
              Save Anti-Cheat Settings
            </Button>
          </div>
        </div>
      </Card>

      {/* Role Permissions */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Lock className="text-purple-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Role Permissions</h2>
        </div>
        <div className="space-y-6">
          {/* Lecturer Permissions */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Lecturer Permissions</h3>
            <div className="space-y-2">
              {Object.entries(rolePermissions.lecturer).map(([permission, enabled]) => (
                <div key={permission} className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 capitalize">
                    {permission.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setRolePermissions({
                      ...rolePermissions,
                      lecturer: { ...rolePermissions.lecturer, [permission]: e.target.checked }
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Moderator Permissions */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Moderator Permissions</h3>
            <div className="space-y-2">
              {Object.entries(rolePermissions.moderator).map(([permission, enabled]) => (
                <div key={permission} className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 capitalize">
                    {permission.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setRolePermissions({
                      ...rolePermissions,
                      moderator: { ...rolePermissions.moderator, [permission]: e.target.checked }
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Admin Permissions */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Admin Permissions</h3>
            <div className="space-y-2">
              {Object.entries(rolePermissions.admin).map(([permission, enabled]) => (
                <div key={permission} className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 capitalize">
                    {permission.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setRolePermissions({
                      ...rolePermissions,
                      admin: { ...rolePermissions.admin, [permission]: e.target.checked }
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => handleSave('Role Permissions')} className="flex items-center gap-2">
              <Save size={18} />
              Save Role Permissions
            </Button>
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="text-orange-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Email Notifications
              </label>
              <p className="text-xs text-gray-500">Send email notifications for important events</p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.emailNotifications}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Quiz Reminders
              </label>
              <p className="text-xs text-gray-500">Send reminders before scheduled quizzes</p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.quizReminders}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, quizReminders: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Result Notifications
              </label>
              <p className="text-xs text-gray-500">Notify students when quiz results are available</p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.resultNotifications}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, resultNotifications: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                System Alerts
              </label>
              <p className="text-xs text-gray-500">Notify admins of system issues</p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.systemAlerts}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, systemAlerts: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => handleSave('Notification')} className="flex items-center gap-2">
              <Save size={18} />
              Save Notification Settings
            </Button>
          </div>
        </div>
      </Card>

      {/* Email Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="text-blue-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Email Configuration</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMTP Host
              </label>
              <Input
                value={emailSettings.smtpHost}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMTP Port
              </label>
              <Input
                value={emailSettings.smtpPort}
                onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })}
                placeholder="587"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SMTP User
            </label>
            <Input
              value={emailSettings.smtpUser}
              onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
              placeholder="your-email@gmail.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Email
            </label>
            <Input
              value={emailSettings.smtpFrom}
              onChange={(e) => setEmailSettings({ ...emailSettings, smtpFrom: e.target.value })}
              placeholder="noreply@quizsystem.com"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Use SSL/TLS
            </label>
            <input
              type="checkbox"
              checked={emailSettings.smtpSecure}
              onChange={(e) => setEmailSettings({ ...emailSettings, smtpSecure: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => handleSave('Email')} className="flex items-center gap-2">
              <Save size={18} />
              Save Email Settings
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
