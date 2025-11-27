"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Building2,
  User,
  Bell,
  Lock,
  Save,
  Download,
  Smartphone,
  Check,
  AlertCircle,
  Chrome,
  Apple,
} from "lucide-react"
import { useGymData } from "@/hooks/useGymData"
import { createBrowserClient } from "@supabase/ssr"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function Settings() {
  const { state } = useGymData()
  const [activeTab, setActiveTab] = useState("pwa")
  const [saveMessage, setSaveMessage] = useState("")
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
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
    const installed =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true

    setIsInstalled(installed)

    if (installed) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstallable(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
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
        setSaveMessage("Please log in to save settings")
        setTimeout(() => setSaveMessage(""), 3000)
        setIsSaving(false)
        return
      }

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
        setSaveMessage("Error saving settings")
      } else {
        setSaveMessage("Settings saved successfully!")
      }

      setTimeout(() => setSaveMessage(""), 3000)
    } catch (error) {
      setSaveMessage("Error saving settings")
      setTimeout(() => setSaveMessage(""), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setIsInstallable(false)
    }
    setDeferredPrompt(null)
  }

  const handleExport = (type: string) => {
    let data: any[] = []
    let filename = ""

    switch (type) {
      case "members":
        data = state.members
        filename = "members.json"
        break
      case "payments":
        data = state.payments
        filename = "payments.json"
        break
      case "attendance":
        data = state.attendance
        filename = "attendance.json"
        break
      case "all":
        data = [{ members: state.members, payments: state.payments, attendance: state.attendance, plans: state.plans }]
        filename = "gym-data-complete.json"
        break
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleNotificationToggle = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handlePasswordChange = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { error } = await supabase.auth.updateUser({
      password: "new-password",
    })

    if (error) {
      alert("Error changing password")
    } else {
      alert("Password changed successfully!")
    }
  }

  const handleClearCache = () => {
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name)
        })
      })
    }
    alert("Cache cleared successfully!")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl p-6 border border-border">
        {activeTab === "profile" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">Profile Settings</h2>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Owner Name</label>
              <input
                type="text"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            {saveMessage && <div className="text-sm text-green-500 mt-2">{saveMessage}</div>}
          </div>
        )}

        {activeTab === "gym" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">Gym Information</h2>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Gym Name</label>
              <input
                type="text"
                name="gymName"
                value={formData.gymName}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            {saveMessage && <div className="text-sm text-green-500 mt-2">{saveMessage}</div>}
          </div>
        )}

        {activeTab === "pwa" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Install MuscleDesk App</h2>

            {isInstalled ? (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <Check size={24} className="text-green-500" />
                <div>
                  <p className="font-semibold text-foreground">App Installed</p>
                  <p className="text-sm text-muted-foreground">MuscleDesk is installed on your device</p>
                </div>
              </div>
            ) : isInstallable ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                  <Smartphone size={24} className="text-accent" />
                  <div>
                    <p className="font-semibold text-foreground">Ready to Install</p>
                    <p className="text-sm text-muted-foreground">Click below to install MuscleDesk</p>
                  </div>
                </div>
                <button
                  onClick={handleInstallClick}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  Install Now
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <AlertCircle size={24} className="text-blue-500" />
                  <div>
                    <p className="font-semibold text-foreground">Manual Installation</p>
                    <p className="text-sm text-muted-foreground">Follow the steps below for your device</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Chrome size={20} className="text-foreground" />
                      <h3 className="font-semibold text-foreground">Chrome / Edge (Desktop)</h3>
                    </div>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Click the install icon in the address bar</li>
                      <li>Or click the three dots menu → Install MuscleDesk</li>
                      <li>Click Install in the popup</li>
                    </ol>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Apple size={20} className="text-foreground" />
                      <h3 className="font-semibold text-foreground">Safari (iPhone/iPad)</h3>
                    </div>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Tap the Share button at the bottom</li>
                      <li>Scroll down and tap Add to Home Screen</li>
                      <li>Tap Add in the top right</li>
                    </ol>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Chrome size={20} className="text-foreground" />
                      <h3 className="font-semibold text-foreground">Chrome (Android)</h3>
                    </div>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Tap the three dots menu in the top right</li>
                      <li>Tap Install app or Add to Home screen</li>
                      <li>Tap Install</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "export" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">Export Data</h2>
            <p className="text-sm text-muted-foreground mb-6">Download your gym data in JSON format</p>

            <div className="space-y-3">
              <button
                onClick={() => handleExport("members")}
                className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-lg transition-colors"
              >
                <span className="text-foreground">Members Data</span>
                <span className="text-sm text-muted-foreground">{state.members.length} records</span>
              </button>

              <button
                onClick={() => handleExport("payments")}
                className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-lg transition-colors"
              >
                <span className="text-foreground">Payments Data</span>
                <span className="text-sm text-muted-foreground">{state.payments.length} records</span>
              </button>

              <button
                onClick={() => handleExport("attendance")}
                className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-lg transition-colors"
              >
                <span className="text-foreground">Attendance Data</span>
                <span className="text-sm text-muted-foreground">{state.attendance.length} records</span>
              </button>

              <button
                onClick={() => handleExport("all")}
                className="w-full flex items-center justify-center gap-2 p-4 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg transition-colors mt-4"
              >
                <Download size={18} />
                Export All Data
              </button>
            </div>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">Notification Preferences</h2>

            {Object.entries(notifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <span className="text-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                <button
                  onClick={() => handleNotificationToggle(key as keyof typeof notifications)}
                  className={`w-12 h-6 rounded-full transition-colors ${value ? "bg-accent" : "bg-muted"}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      value ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">Security Settings</h2>

            <div className="space-y-3">
              <button
                onClick={handlePasswordChange}
                className="w-full p-4 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-left"
              >
                <p className="text-foreground font-medium">Change Password</p>
                <p className="text-sm text-muted-foreground">Update your account password</p>
              </button>

              <button
                onClick={handleClearCache}
                className="w-full p-4 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-left"
              >
                <p className="text-foreground font-medium">Clear Cache</p>
                <p className="text-sm text-muted-foreground">Clear app cache and temporary data</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
