import { SettingsEditor } from "@/components/admin/SettingsEditor";
import { getAllPlatformSettings } from "@/lib/billing/settings";

export default async function AdminSettingsPage() {
  const settings = await getAllPlatformSettings();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Platform settings</h1>
        <p className="text-sm text-zinc-600">Super admin only. Changes are audit-logged.</p>
      </div>
      <SettingsEditor settings={settings} />
    </div>
  );
}
