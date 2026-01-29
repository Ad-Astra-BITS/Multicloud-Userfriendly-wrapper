'use client';

/**
 * Kill Switch Page
 *
 * Emergency shutdown page for destroying all cloud resources.
 * Contains the KillSwitch component with OTP verification.
 */

import DashboardLayout from '@/components/DashboardLayout';
import KillSwitch from '@/components/KillSwitch';

export default function KillSwitchPage() {
  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Kill Switch</h1>
        <p className="text-slate-400 mt-1">
          Emergency resource termination control
        </p>
      </div>

      {/* Kill Switch component */}
      <KillSwitch />
    </DashboardLayout>
  );
}
