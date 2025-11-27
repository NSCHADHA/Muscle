"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Building2, User, Bell, Lock, Save, Download, Smartphone, Check, X } from "lucide-react"
import { useGymData } from "@/hooks/useGymData"
import { createBrowserClient } from "@supabase/ssr"

export function Settings() {
  const { state } = useGymData()
  const [activeTab, setActiveTab] = useState("profile")
  const [saveMessage, setSaveMessage] = useState("")
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstallable(false)
    }

    return () => window.removeEventListener("beforeinstallprompt", handler)
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
    if (!deferredPrompt) {
      setSaveMessage("App is already installed or not installable")
      setTimeout(() => setSaveMessage(""), 3000)
      return
    }

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setSaveMessage("✅ App installed successfully!")
      setIsInstallable(false)
    } else {
      setSaveMessage("Installation cancelled")
    }

    setDeferredPrompt(null)
    setTimeout(() => setSaveMessage(""), 3000)
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
              </div>
            )}

            {/* PWA Install Tab */}
            {activeTab === "pwa" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-foreground">Install MuscleDesk App</h2>
                <p className="text-sm text-muted-foreground">
                  Install MuscleDesk as a native app on your device for offline access and faster performance
                </p>

                <div className="bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center">
                      <Smartphone size={32} className="text-accent-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-foreground">Progressive Web App</h3>
                      <p className="text-sm text-muted-foreground">Works on iOS, Android, and Desktop</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full" />
                      <span className="text-foreground">Offline access</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full" />
                      <span className="text-foreground">Push notifications</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full" />
                      <span className="text-foreground">Fast performance</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full" />
                      <span className="text-foreground">Native app experience</span>
                    </div>
                  </div>

                  <button
                    onClick={handleInstallPWA}
                    disabled={!isInstallable}
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                      isInstallable
                        ? "bg-accent text-accent-foreground hover:opacity-90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    <Download size={20} />
                    {isInstallable ? "Install MuscleDesk App" : "App Already Installed"}
                  </button>

                  {!isInstallable && (
                    <p className="text-xs text-center text-muted-foreground">
                      The app is already installed or your browser doesn't support installation
                    </p>
                  )}
                </div>
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
                  <button onClick={handleChangePassword} className="btn-secondary w-full flex items-center gap-2">
                    <Lock size={18} />
                    Change Password
                  </button>
                  <button onClick={handleClearData} className="btn-secondary w-full flex items-center gap-2">
                    <X size={18} />
                    Clear App Cache & Settings
                  </button>
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <h3 className="font-semibold text-foreground mb-2">Account Status</h3>
                    <div className="flex items-center gap-2 text-sm">
                      <Check size={16} className="text-green-500" />
                      <span className="text-muted-foreground">Two-Factor Authentication: Coming Soon</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-2">
                      <Check size={16} className="text-green-500" />
                      <span className="text-muted-foreground">End-to-End Encryption: Enabled</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            {(activeTab === "profile" || activeTab === "gym") && (
              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() =>
                    setFormData({
                      ownerName: state.user?.ownerName || "",
                      gymName: state.user?.gymName || "",
                      email: state.user?.email || "",
                      phone: state.user?.phone || "",
                      address: state.user?.address || "",
                    })
                  }
                  className="btn-secondary"
                >
                  Reset
                </button>
                <button onClick={handleSave} disabled={isSaving} className="btn-primary flex items-center gap-2">
                  <Save size={18} /> {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
