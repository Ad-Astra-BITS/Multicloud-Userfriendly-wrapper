'use client';

/**
 * Settings Page
 *
 * Account settings, notification preferences, and cloud provider configuration.
 */

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  User,
  Bell,
  Shield,
  Cloud,
  Moon,
  Globe,
  Key,
  Check,
  ChevronRight,
} from 'lucide-react';

// ============================================
// Toggle Switch Component
// ============================================

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function ToggleSwitch({ enabled, onChange }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-slate-700'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
          enabled ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  );
}

// ============================================
// Settings Section Component
// ============================================

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function SettingsSection({
  title,
  description,
  icon,
  children,
}: SettingsSectionProps) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 p-6 border-b border-slate-700/50">
        <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h2 className="font-semibold text-white">{title}</h2>
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {/* Section content */}
      <div className="p-6">{children}</div>
    </div>
  );
}

// ============================================
// Settings Row Component
// ============================================

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-700/30 last:border-0">
      <div>
        <p className="text-sm text-white">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================
// Main Settings Page
// ============================================

export default function SettingsPage() {
  // Notification settings state
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [costThreshold, setCostThreshold] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [slackIntegration, setSlackIntegration] = useState(false);

  // Appearance settings state
  const [darkMode, setDarkMode] = useState(true);
  const [compactView, setCompactView] = useState(false);

  // Security settings
  const [twoFactor, setTwoFactor] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(false);

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">
          Manage your account and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <SettingsSection
          title="Profile"
          description="Manage your account information"
          icon={<User size={20} className="text-blue-400" />}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Admin User</h3>
              <p className="text-sm text-slate-400">admin@adastra.cloud</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Full Name
              </label>
              <input
                type="text"
                defaultValue="Admin User"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Email Address
              </label>
              <input
                type="email"
                defaultValue="admin@adastra.cloud"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </SettingsSection>

        {/* Notifications Section */}
        <SettingsSection
          title="Notifications"
          description="Configure how you receive alerts"
          icon={<Bell size={20} className="text-amber-400" />}
        >
          <SettingsRow
            label="Email Alerts"
            description="Receive critical alerts via email"
          >
            <ToggleSwitch enabled={emailAlerts} onChange={setEmailAlerts} />
          </SettingsRow>

          <SettingsRow
            label="Cost Threshold Alerts"
            description="Alert when spending exceeds budget"
          >
            <ToggleSwitch enabled={costThreshold} onChange={setCostThreshold} />
          </SettingsRow>

          <SettingsRow
            label="Weekly Cost Report"
            description="Receive weekly cost summary"
          >
            <ToggleSwitch enabled={weeklyReport} onChange={setWeeklyReport} />
          </SettingsRow>

          <SettingsRow
            label="Slack Integration"
            description="Send alerts to Slack channel"
          >
            <ToggleSwitch
              enabled={slackIntegration}
              onChange={setSlackIntegration}
            />
          </SettingsRow>
        </SettingsSection>

        {/* Security Section */}
        <SettingsSection
          title="Security"
          description="Protect your account"
          icon={<Shield size={20} className="text-green-400" />}
        >
          <SettingsRow
            label="Two-Factor Authentication"
            description="Add an extra layer of security"
          >
            <ToggleSwitch enabled={twoFactor} onChange={setTwoFactor} />
          </SettingsRow>

          <SettingsRow
            label="Auto Session Timeout"
            description="Automatically log out after inactivity"
          >
            <ToggleSwitch
              enabled={sessionTimeout}
              onChange={setSessionTimeout}
            />
          </SettingsRow>

          <SettingsRow label="API Keys" description="Manage your API credentials">
            <button className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
              Manage
              <ChevronRight size={14} />
            </button>
          </SettingsRow>
        </SettingsSection>

        {/* Cloud Providers Section */}
        <SettingsSection
          title="Cloud Providers"
          description="Connected cloud accounts"
          icon={<Cloud size={20} className="text-purple-400" />}
        >
          <div className="space-y-3">
            {[
              {
                name: 'AWS',
                status: 'Connected',
                account: 'prod-account-123',
                color: 'orange',
              },
              {
                name: 'Azure',
                status: 'Not Connected',
                account: null,
                color: 'blue',
              },
              {
                name: 'GCP',
                status: 'Not Connected',
                account: null,
                color: 'red',
              },
            ].map((provider) => (
              <div
                key={provider.name}
                className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg bg-${provider.color}-500/20 flex items-center justify-center`}
                  >
                    <Cloud size={20} className={`text-${provider.color}-400`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white">
                      {provider.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {provider.account || 'No account connected'}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    provider.status === 'Connected'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {provider.status}
                </span>
              </div>
            ))}
          </div>
        </SettingsSection>

        {/* Appearance Section */}
        <SettingsSection
          title="Appearance"
          description="Customize your dashboard"
          icon={<Moon size={20} className="text-indigo-400" />}
        >
          <SettingsRow label="Dark Mode" description="Use dark theme">
            <ToggleSwitch enabled={darkMode} onChange={setDarkMode} />
          </SettingsRow>

          <SettingsRow
            label="Compact View"
            description="Show more content in less space"
          >
            <ToggleSwitch enabled={compactView} onChange={setCompactView} />
          </SettingsRow>

          <SettingsRow label="Language" description="Interface language">
            <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
              <option>German</option>
            </select>
          </SettingsRow>
        </SettingsSection>

        {/* Save button */}
        <div className="flex justify-end">
          <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
            <Check size={16} />
            Save Changes
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
