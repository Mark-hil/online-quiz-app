import { useState, useEffect } from 'react';
import { Link2, Key, Globe, Shield, Plus, Trash2, Eye, EyeOff, Save, TestTube } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { db } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface Integration {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  description: string;
  lastUsed?: string;
}

interface APIKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed?: string;
  scopes: string[];
}

export default function IntegrationManagement() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: '1',
      name: 'Google OAuth',
      type: 'authentication',
      status: import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'active' : 'inactive',
      description: 'Allow users to sign in with Google account',
    },
    {
      id: '2',
      name: 'Email Service (SMTP)',
      type: 'notification',
      status: import.meta.env.VITE_SMTP_HOST ? 'active' : 'inactive',
      description: 'Send email notifications and alerts',
      lastUsed: import.meta.env.VITE_SMTP_HOST ? new Date().toISOString() : undefined,
    },
    {
      id: '3',
      name: 'Google Analytics',
      type: 'analytics',
      status: import.meta.env.VITE_GA_TRACKING_ID ? 'active' : 'inactive',
      description: 'Track user behavior and system usage',
    },
  ]);

  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);

  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({});
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);

  // OAuth Configuration State
  const [googleConfig, setGoogleConfig] = useState({
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
    redirectUri: import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:5173/auth/google/callback',
  });

  const [githubConfig, setGithubConfig] = useState({
    clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
    clientSecret: import.meta.env.VITE_GITHUB_CLIENT_SECRET || '',
    redirectUri: import.meta.env.VITE_GITHUB_OAUTH_REDIRECT_URI || 'http://localhost:5173/auth/github/callback',
  });

  // SMTP Configuration State
  const [smtpConfig, setSmtpConfig] = useState({
    host: import.meta.env.VITE_SMTP_HOST || '',
    port: import.meta.env.VITE_SMTP_PORT || '587',
    username: import.meta.env.VITE_SMTP_USERNAME || '',
    password: import.meta.env.VITE_SMTP_PASSWORD || '',
    from: import.meta.env.VITE_SMTP_FROM || 'noreply@quizsystem.com',
    secure: import.meta.env.VITE_SMTP_SECURE === 'true',
  });

  // S3 Configuration State
  const [s3Config, setS3Config] = useState({
    bucketName: import.meta.env.VITE_S3_BUCKET_NAME || '',
    region: import.meta.env.VITE_S3_AWS_REGION || '',
    accessKeyId: import.meta.env.VITE_S3_ACCESS_KEY_ID || '',
    secretAccessKey: import.meta.env.VITE_S3_SECRET_ACCESS_KEY || '',
  });

  useEffect(() => {
    loadSettingsFromDatabase();
  }, []);

  const loadSettingsFromDatabase = async () => {
    try {
      const settings = await db.getAllSystemSettings();
      settings.forEach((setting: any) => {
        const value = setting.setting_value;
        switch (setting.setting_key) {
          case 'google_oauth':
            setGoogleConfig(value);
            break;
          case 'github_oauth':
            setGithubConfig(value);
            break;
          case 'smtp_config':
            setSmtpConfig(value);
            break;
          case 's3_config':
            setS3Config(value);
            break;
        }
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSaveConfig = async (type: string, config: any) => {
    try {
      await db.setSystemSetting(type, config, `${type} configuration`, user?.id);
      alert(`${type} configuration saved successfully`);
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration');
    }
  };

  const toggleApiKeyVisibility = (keyId: string) => {
    setShowApiKey((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) return;

    const newKey: APIKey = {
      id: Date.now().toString(),
      name: newKeyName,
      key: `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
      created: new Date().toISOString(),
      scopes: newKeyScopes,
    };

    setApiKeys([...apiKeys, newKey]);
    setNewKeyName('');
    setNewKeyScopes(['read']);
  };

  const handleDeleteApiKey = (keyId: string) => {
    if (confirm('Are you sure you want to delete this API key?')) {
      setApiKeys(apiKeys.filter((key) => key.id !== keyId));
    }
  };

  const handleToggleIntegration = (integrationId: string) => {
    setIntegrations(
      integrations.map((integration) =>
        integration.id === integrationId
          ? { ...integration, status: integration.status === 'active' ? 'inactive' : 'active' }
          : integration
      )
    );
  };

  const handleTestIntegration = (integrationId: string) => {
    alert(`Testing integration connection...`);
  };

  const getStatusBadgeVariant = (status: string): 'primary' | 'success' | 'danger' | 'warning' | 'secondary' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'secondary';
      case 'error':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integration Management</h1>
          <p className="text-gray-600">Configure third-party integrations, API keys, and external services</p>
        </div>
        <Badge variant="primary">
          Super Admin
        </Badge>
      </div>

      {/* Third-Party Integrations */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link2 className="text-blue-600" size={24} />
            <h2 className="text-lg font-semibold text-gray-900">Third-Party Integrations</h2>
          </div>
          <Button size="sm">
            <Plus size={16} className="mr-2" />
            Add Integration
          </Button>
        </div>
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div key={integration.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-gray-900">{integration.name}</h3>
                    <Badge variant={getStatusBadgeVariant(integration.status)}>{integration.status}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{integration.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Type: {integration.type}</span>
                    {integration.lastUsed && <span>Last used: {new Date(integration.lastUsed).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleTestIntegration(integration.id)}
                  >
                    <TestTube size={16} className="mr-1" />
                    Test
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleToggleIntegration(integration.id)}
                  >
                    {integration.status === 'active' ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* API Keys Management */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Key className="text-purple-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
        </div>
        <div className="space-y-4">
          {/* Create New API Key */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-gray-900 mb-3">Create New API Key</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <Input
                placeholder="API Key Name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <div className="flex gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newKeyScopes.includes('read')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewKeyScopes([...newKeyScopes, 'read']);
                      } else {
                        setNewKeyScopes(newKeyScopes.filter((s) => s !== 'read'));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  Read
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newKeyScopes.includes('write')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewKeyScopes([...newKeyScopes, 'write']);
                      } else {
                        setNewKeyScopes(newKeyScopes.filter((s) => s !== 'write'));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  Write
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newKeyScopes.includes('admin')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewKeyScopes([...newKeyScopes, 'admin']);
                      } else {
                        setNewKeyScopes(newKeyScopes.filter((s) => s !== 'admin'));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  Admin
                </label>
              </div>
              <Button onClick={handleCreateApiKey} className="flex items-center justify-center gap-2">
                <Plus size={16} />
                Generate Key
              </Button>
            </div>
          </div>

          {/* API Keys List */}
          <div className="space-y-3">
            {apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900">{apiKey.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {showApiKey[apiKey.id] ? apiKey.key : '•'.repeat(32)}
                      </code>
                      <button
                        onClick={() => toggleApiKeyVisibility(apiKey.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {showApiKey[apiKey.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Created: {new Date(apiKey.created).toLocaleString()}</span>
                      {apiKey.lastUsed && <span>Last used: {new Date(apiKey.lastUsed).toLocaleString()}</span>}
                      <span>Scopes: {apiKey.scopes.join(', ')}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDeleteApiKey(apiKey.id)}
                  >
                    <Trash2 size={16} className="mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Authentication Providers */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="text-green-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Authentication Providers</h2>
        </div>
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="text-blue-600" size={20} />
                  <h3 className="font-medium text-gray-900">Google OAuth 2.0</h3>
                  <Badge variant={googleConfig.clientId ? 'success' : 'secondary'}>
                    {googleConfig.clientId ? 'Configured' : 'Not Configured'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Allow users to sign in with their Google account
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="Google Client ID"
                    value={googleConfig.clientId}
                    onChange={(e) => setGoogleConfig({ ...googleConfig, clientId: e.target.value })}
                  />
                  <Input
                    type="password"
                    placeholder="Google Client Secret"
                    value={googleConfig.clientSecret}
                    onChange={(e) => setGoogleConfig({ ...googleConfig, clientSecret: e.target.value })}
                  />
                  <Input
                    placeholder="OAuth Redirect URI"
                    value={googleConfig.redirectUri}
                    onChange={(e) => setGoogleConfig({ ...googleConfig, redirectUri: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 ml-4">
                <Button size="sm" onClick={() => handleSaveConfig('google_oauth', googleConfig)}>
                  <Save size={16} className="mr-2" />
                  Save Configuration
                </Button>
                <Button size="sm" variant="secondary">
                  <TestTube size={16} className="mr-2" />
                  Test Connection
                </Button>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="text-blue-600" size={20} />
                  <h3 className="font-medium text-gray-900">GitHub OAuth 2.0</h3>
                  <Badge variant={githubConfig.clientId ? 'success' : 'secondary'}>
                    {githubConfig.clientId ? 'Configured' : 'Not Configured'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Allow users to sign in with their GitHub account
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="GitHub Client ID"
                    value={githubConfig.clientId}
                    onChange={(e) => setGithubConfig({ ...githubConfig, clientId: e.target.value })}
                  />
                  <Input
                    type="password"
                    placeholder="GitHub Client Secret"
                    value={githubConfig.clientSecret}
                    onChange={(e) => setGithubConfig({ ...githubConfig, clientSecret: e.target.value })}
                  />
                  <Input
                    placeholder="OAuth Redirect URI"
                    value={githubConfig.redirectUri}
                    onChange={(e) => setGithubConfig({ ...githubConfig, redirectUri: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 ml-4">
                <Button size="sm" onClick={() => handleSaveConfig('github_oauth', githubConfig)}>
                  <Save size={16} className="mr-2" />
                  Save Configuration
                </Button>
                <Button size="sm" variant="secondary">
                  <TestTube size={16} className="mr-2" />
                  Test Connection
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* External Services */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="text-purple-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">External Services</h2>
        </div>
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-2">Email Service (SMTP)</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Configure SMTP settings for sending emails
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="SMTP Host"
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                  />
                  <Input
                    placeholder="SMTP Port"
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                  />
                  <Input
                    placeholder="SMTP Username"
                    value={smtpConfig.username}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                  />
                  <Input
                    type="password"
                    placeholder="SMTP Password"
                    value={smtpConfig.password}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                  />
                  <Input
                    placeholder="From Email"
                    value={smtpConfig.from}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, from: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="checkbox"
                    checked={smtpConfig.secure}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="text-sm text-gray-700">Use SSL/TLS</label>
                </div>
              </div>
              <div className="flex flex-col gap-2 ml-4">
                <Button size="sm" onClick={() => handleSaveConfig('smtp_config', smtpConfig)}>
                  <Save size={16} className="mr-2" />
                  Save Configuration
                </Button>
                <Button size="sm" variant="secondary">
                  <TestTube size={16} className="mr-2" />
                  Test Connection
                </Button>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-2">Storage Service (S3)</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Configure S3-compatible storage for file uploads
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="S3 Bucket Name"
                    value={s3Config.bucketName}
                    onChange={(e) => setS3Config({ ...s3Config, bucketName: e.target.value })}
                  />
                  <Input
                    placeholder="AWS Region"
                    value={s3Config.region}
                    onChange={(e) => setS3Config({ ...s3Config, region: e.target.value })}
                  />
                  <Input
                    placeholder="Access Key ID"
                    value={s3Config.accessKeyId}
                    onChange={(e) => setS3Config({ ...s3Config, accessKeyId: e.target.value })}
                  />
                  <Input
                    type="password"
                    placeholder="Secret Access Key"
                    value={s3Config.secretAccessKey}
                    onChange={(e) => setS3Config({ ...s3Config, secretAccessKey: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 ml-4">
                <Button size="sm" onClick={() => handleSaveConfig('s3_config', s3Config)}>
                  <Save size={16} className="mr-2" />
                  Save Configuration
                </Button>
                <Button size="sm" variant="secondary">
                  <TestTube size={16} className="mr-2" />
                  Test Connection
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
