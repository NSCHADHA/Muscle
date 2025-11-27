"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Building2, User, Bell, Lock, Save, Download, Smartphone, Check, X, AlertCircle } from "lucide-react"
import { useGymData } from "@/hooks/useGymData"
import { createBrowserClient } from "@supabase/ssr"

export function Settings() {
  const { state } = useGymData()
  const [activeTab, setActiveTab] = useState("pwa") // Default to PWA tab
  const [saveMessage, setSaveMessage] = useState("")
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([]) // Add debug info

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsAlerts: true,
    pushNotifications: true,
    weeklyReports: false,
  })

  const [formData, setFormData] = useState({
    ownerName: state.user?.ownerName || "",
    gymName: state.user?.gymName || "",
    email: state.user?.email || "",
    phone: state.user?.phone || "",
    address: state.user?.address || "",
  })

  useEffect(() => {
    const savedNotifications = localStorage.getItem("muscledesk_notifications")
    if (savedNotifications) {
      setNotifications(JSON.parse(savedNotifications))
    }
  }, [])

  useEffect(() => {
    const addDebug = (msg: string) => {
      console.log("[v0]", msg)
      setDebugInfo((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
    }

    addDebug("PWA check started")

    // Check if already installed
    const installed =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true

    setIsInstalled(installed)
    addDebug(`App installed: ${installed}`)

    if (installed) {
      addDebug("App already installed, not showing prompt")
      return
    }

    // Check if prompt was dismissed
    const isDismissed = localStorage.getItem("pwa-install-dismissed")
    if (isDismissed) {
      const dismissedTime = Number.parseInt(isDismissed)
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)
      addDebug(`Dismissed ${daysSinceDismissed.toFixed(1)} days ago`)
    }

    const handler = (e: any) => {
      addDebug("beforeinstallprompt event fired!")
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
      addDebug("Install prompt is now available")
    }

    window.addEventListener("beforeinstallprompt", handler)
    addDebug("Event listener registered")

    // Check service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          addDebug(`Service worker registered: ${reg.active ? "active" : "installing"}`)
        } else {
          addDebug("Service worker not registered")
        }
      })
    } else {
      addDebug("Service worker not supported")
    }

    // Check manifest
    const manifestLink = document.querySelector('link[rel="manifest"]')
    addDebug(`Manifest link found: ${!!manifestLink}`)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      addDebug("Event listener removed")
    }
  }, [])

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "gym", label: "Gym Information", icon: Building2 },
    { id: "pwa", label: "Install App", icon: Smartphone },
    { id: "export", label: "Export Data", icon: Download },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Lock },
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setSaveMessage("❌ Please log in to save settings")
        setTimeout(() => setSaveMessage(""), 3000)
        setIsSaving(false)
        return
      }

      // Update profile in database
      const { error } = await supabase
        .from("profiles")
        .update({
          owner_name: formData.ownerName,
          gym_name: formData.gymName,
          email: formData.email,
          phone: formData.phone,
        })
        .eq("id", user.id)

      if (error) {
        console.error("[v0] Error saving profile:", error)
        setSaveMessage("❌ Failed to save settings")
      } else {
        setSaveMessage("✅ Settings saved successfully!")
      }
    } catch (error) {
      console.error("[v0] Save error:", error)
      setSaveMessage("❌ Failed to save settings")
    }

    setIsSaving(false)
    setTimeout(() => setSaveMessage(""), 3000)
  }

  const handleNotificationToggle = (key: keyof typeof notifications) => {
    const newNotifications = { ...notifications, [key]: !notifications[key] }
    setNotifications(newNotifications)
    localStorage.setItem("muscledesk_notifications", JSON.stringify(newNotifications))
    setSaveMessage("✅ Notification preferences updated")
    setTimeout(() => setSaveMessage(""), 3000)
  }

  const handleInstallPWA = async () => {
    console.log("[v0] Install button clicked")
    setDebugInfo((prev) => [...prev, `${new Date().toLocaleTimeString()}: Install clicked`])

    if (!deferredPrompt) {
      setSaveMessage("⚠️ Install prompt not available. See instructions below.")
      setTimeout(() => setSaveMessage(""), 5000)
      return
    }

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      console.log("[v0] Install outcome:", outcome)
      setDebugInfo((prev) => [...prev, `${new Date().toLocaleTimeString()}: User ${outcome} installation`])

      if (outcome === "accepted") {
        setSaveMessage("✅ App installed successfully!")
        setIsInstallable(false)
        setIsInstalled(true)
        localStorage.removeItem("pwa-install-dismissed")
      } else {
        setSaveMessage("Installation cancelled")
      }

      setDeferredPrompt(null)
      setTimeout(() => setSaveMessage(""), 3000)
    } catch (error) {
      console.error("[v0] Install error:", error)
      setSaveMessage("❌ Installation failed. Try manual installation below.")
      setTimeout(() => setSaveMessage(""), 5000)
    }
  }

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      setSaveMessage("❌ No data to export")
      setTimeout(() => setSaveMessage(""), 3000)
      return
    }

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(","),
      ...data.map((row) => headers.map((header) => JSON.stringify(row[header] || "")).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setSaveMessage(`✅ ${filename} exported successfully`)
    setTimeout(() => setSaveMessage(""), 3000)
  }

  const handleExportMembers = () => {
    const memberData = state.members.map((m) => ({
      Name: m.name,
      Email: m.email,
      Phone: m.phone,
      Duration: `${m.plan_duration} months`,
      Status: m.status,
      JoinDate: m.joining_date,
      ExpiryDate: m.expiry_date,
    }))
    exportToCSV(memberData, "members")
  }

  const handleExportPayments = () => {
    const paymentData = state.payments.map((p) => ({
      MemberName: p.member_name,
      Amount: p.amount,
      Date: p.payment_date,
      Mode: p.payment_method,
      Status: p.status,
    }))
    exportToCSV(paymentData, "payments")
  }

  const handleExportPlans = () => {
    const planData = state.plans.map((p) => ({
      Name: p.name,
      Price: p.price,
      Duration: `${p.duration} days`,
      Features: p.features.join("; "),
    }))
    exportToCSV(planData, "plans")
  }

  const handleExportRevenue = () => {
    const monthlyRevenue: { [key: string]: number } = {}
    state.payments
      .filter((p) => p.status === "completed")
      .forEach((p) => {
        const dateStr = p.payment_date || p.created_at || "1970-01-01"
        const month = dateStr.substring(0, 7)
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + p.amount
      })

    const revenueData = Object.entries(monthlyRevenue).map(([month, revenue]) => ({
      Month: month,
      Revenue: revenue,
    }))
    exportToCSV(revenueData, "monthly_revenue")
  }

  const handleChangePassword = async () => {
    const newPassword = prompt("Enter new password (min 6 characters):")
    if (!newPassword || newPassword.length < 6) {
      setSaveMessage("❌ Password must be at least 6 characters")
      setTimeout(() => setSaveMessage(""), 3000)
      return
    }

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) {
        setSaveMessage("❌ Failed to change password")
        console.error("[v0] Password change error:", error)
      } else {
        setSaveMessage("✅ Password changed successfully!")
      }
    } catch (error) {
      setSaveMessage("❌ Failed to change password")
      console.error("[v0] Password change error:", error)
    }

    setTimeout(() => setSaveMessage(""), 3000)
  }

  const handleClearData = async () => {
    const confirmed = confirm(
      "⚠️ WARNING: This will clear all app cache and settings. Your data in the database will remain safe. Continue?",
    )
    if (!confirmed) return

    try {
      localStorage.clear()
      if ("caches" in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map((name) => caches.delete(name)))
      }
      setSaveMessage("✅ App cache cleared! Please refresh the page.")
      setTimeout(() => window.location.reload(), 2000)
    } catch (error) {
      setSaveMessage("❌ Failed to clear cache")
      console.error("[v0] Clear cache error:", error)
    }
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">Manage your gym profile and preferences.</p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-lg">
          <p className="font-semibold text-foreground">{saveMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tab Navigation */}
        <div className="stat-card h-fit">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-medium ${
                    activeTab === tab.id ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon size={18} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="stat-card">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-foreground">Profile Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Owner Name</label>
                    <input
                      type="text"
                      name="ownerName"
                      value={formData.ownerName}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>
                </div>
                <button onClick={handleSave} disabled={isSaving} className="btn-primary">
                  <Save size={18} />
                  {isSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            )}

            {/* Gym Tab */}
            {activeTab === "gym" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-foreground">Gym Information</h2>
                <div>
                  <label className="form-label">Gym Name</label>
                  <input
                    type="text"
                    name="gymName"
                    value={formData.gymName}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="form-input"
                    rows={3}
                  />
                </div>
                <button onClick={handleSave} disabled={isSaving} className="btn-primary">
                  <Save size={18} />
                  {isSaving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            )}

            {/* PWA Install Tab - Enhanced */}
            {activeTab === "pwa" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-foreground">Install MuscleDesk App</h2>
                <p className="text-sm text-muted-foreground">
                  Install MuscleDesk as a native app on your device for offline access and faster performance
                </p>

                {/* Install Status Card */}
                <div
                  className={`p-6 rounded-xl border-2 ${
                    isInstalled
                      ? "bg-green-500/10 border-green-500/30"
                      : isInstallable
                        ? "bg-accent/10 border-accent/30"
                        : "bg-muted/50 border-border"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                        isInstalled ? "bg-green-500" : isInstallable ? "bg-accent" : "bg-muted"
                      }`}
                    >
                      {isInstalled ? (
                        <Check size={32} className="text-white" />
                      ) : (
                        <Smartphone
                          size={32}
                          className={isInstallable ? "text-accent-foreground" : "text-muted-foreground"}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-foreground">
                        {isInstalled ? "App Installed ✓" : isInstallable ? "Ready to Install" : "Installation Status"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isInstalled
                          ? "You're using the installed app"
                          : isInstallable
                            ? "Click below to install"
                            : "Follow manual instructions below"}
                      </p>
                    </div>
                  </div>

                  {!isInstalled && (
                    <button
                      onClick={handleInstallPWA}
                      disabled={!isInstallable}
                      className={`w-full mt-4 py-3 px-6 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                        isInstallable
                          ? "bg-accent text-accent-foreground hover:opacity-90"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      <Download size={20} />
                      {isInstallable ? "Install MuscleDesk App" : "Install Not Available"}
                    </button>
                  )}
                </div>

                {/* Benefits */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {["Works offline", "Push notifications", "Faster performance", "Native app experience"].map(
                    (benefit) => (
                      <div key={benefit} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <Check size={16} className="text-accent flex-shrink-0" />
                        <span className="text-sm text-foreground">{benefit}</span>
                      </div>
                    ),
                  )}
                </div>

                {/* Manual Installation Instructions */}
                {!isInstalled && !isInstallable && (
                  <div className="bg-muted/50 border border-border rounded-xl p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={24} className="text-accent flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-foreground mb-2">Manual Installation Guide</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          The automatic install prompt isn't available. Follow these steps:
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Chrome/Edge Instructions */}
                      <div className="bg-background p-4 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Chrome/Edge (Desktop)</h4>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                          <li>Click the install icon in the address bar (right side)</li>
                          <li>Or click menu (⋮) → "Install MuscleDesk..."</li>
                          <li>Click "Install" in the popup</li>
                        </ol>
                      </div>

                      {/* Safari iOS Instructions */}
                      <div className="bg-background p-4 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Safari (iPhone/iPad)</h4>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                          <li>Tap the Share button (square with arrow)</li>
                          <li>Scroll down and tap "Add to Home Screen"</li>
                          <li>Tap "Add" to confirm</li>
                        </ol>
                      </div>

                      {/* Android Chrome Instructions */}
                      <div className="bg-background p-4 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Chrome (Android)</h4>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                          <li>Tap menu (⋮) in the top right</li>
                          <li>Tap "Install app" or "Add to Home screen"</li>
                          <li>Tap "Install" to confirm</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}

                {/* Debug Info - Only in dev */}
                {debugInfo.length > 0 && (
                  <details className="bg-muted/30 rounded-lg p-4 text-xs">
                    <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                      Debug Information (for development)
                    </summary>
                    <div className="mt-3 space-y-1 font-mono text-muted-foreground max-h-48 overflow-y-auto">
                      {debugInfo.map((info, i) => (
                        <div key={i}>{info}</div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Export Tab */}
            {activeTab === "export" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-foreground">Export Data</h2>
                <p className="text-sm text-muted-foreground">Download your gym data in CSV format</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={handleExportMembers} className="btn-primary flex items-center gap-2 justify-center">
                    <Download size={18} /> Export Members ({state.members.length})
                  </button>
                  <button onClick={handleExportPayments} className="btn-primary flex items-center gap-2 justify-center">
                    <Download size={18} /> Export Payments ({state.payments.length})
                  </button>
                  <button onClick={handleExportPlans} className="btn-primary flex items-center gap-2 justify-center">
                    <Download size={18} /> Export Plans ({state.plans.length})
                  </button>
                  <button onClick={handleExportRevenue} className="btn-primary flex items-center gap-2 justify-center">
                    <Download size={18} /> Export Monthly Revenue
                  </button>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-foreground">Notification Preferences</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage how you receive updates about membership expirations and payments
                </p>
                <div className="space-y-3">
                  {Object.entries({
                    emailNotifications: "Email notifications for expiring memberships",
                    smsAlerts: "SMS alerts for important updates",
                    pushNotifications: "Push notifications (when app is installed)",
                    weeklyReports: "Weekly revenue and membership reports",
                  }).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg cursor-pointer border border-border"
                    >
                      <span className="font-medium text-foreground">{label}</span>
                      <button
                        onClick={() => handleNotificationToggle(key as keyof typeof notifications)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          notifications[key as keyof typeof notifications] ? "bg-accent" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notifications[key as keyof typeof notifications] ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-foreground">Security & Privacy</h2>
                <p className="text-sm text-muted-foreground mb-4">Manage your account security settings</p>
                <div className="space-y-4">
                  <button
                    onClick={handleChangePassword}
                    className="btn-secondary w-full flex items-center gap-2 justify-center"
                  >
                    <Lock size={18} />
                    Change Password
                  </button>
                  <button
                    onClick={handleClearData}
                    className="btn-secondary w-full flex items-center gap-2 justify-center"
                  >
                    <X size={18} />
                    Clear App Cache & Settings
                  </button>
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <h3 className="font-semibold text-foreground mb-2">Account Status</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check size={16} className="text-green-500" />
                      <span>Account secured with Supabase Auth</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button for profile/gym tabs */}
            {(activeTab === "profile" || activeTab === "gym") && saveMessage === "" && (
              <button onClick={handleSave} disabled={isSaving} className="btn-primary mt-6 flex items-center gap-2">
                <Save size={18} />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
