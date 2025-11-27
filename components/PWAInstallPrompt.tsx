"use client"

import { useState, useEffect } from "react"
import { Download, X } from "lucide-react"

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    console.log("[v0] PWA Install Prompt component mounted")

    // Check if already installed
    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true

    console.log("[v0] PWA installed status:", isInstalled)

    if (isInstalled) {
      console.log("[v0] App already installed, not showing prompt")
      return
    }

    // Check if user dismissed the prompt before
    const isDismissed = localStorage.getItem("pwa-install-dismissed")
    if (isDismissed) {
      const dismissedTime = Number.parseInt(isDismissed)
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)
      console.log("[v0] Days since dismissed:", daysSinceDismissed)

      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        console.log("[v0] Prompt dismissed less than 7 days ago")
        return
      }
    }

    const handler = (e: any) => {
      console.log("[v0] beforeinstallprompt event fired!")
      e.preventDefault()
      setDeferredPrompt(e)

      // Show prompt after 3 seconds
      setTimeout(() => {
        console.log("[v0] Showing install prompt")
        setShowPrompt(true)
      }, 3000)
    }

    window.addEventListener("beforeinstallprompt", handler)
    console.log("[v0] beforeinstallprompt listener added")

    return () => {
      console.log("[v0] PWA component unmounting")
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleInstall = async () => {
    console.log("[v0] Install button clicked")
    if (!deferredPrompt) {
      console.log("[v0] No deferred prompt available")
      return
    }

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log("[v0] Install outcome:", outcome)

    if (outcome === "accepted") {
      setShowPrompt(false)
      localStorage.removeItem("pwa-install-dismissed")
    }

    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    console.log("[v0] Prompt dismissed by user")
    setShowPrompt(false)
    localStorage.setItem("pwa-install-dismissed", Date.now().toString())
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card border-2 border-accent shadow-2xl rounded-2xl p-4 max-w-sm">
        <button
          onClick={handleDismiss}
          className="absolute -top-2 -right-2 w-6 h-6 bg-muted hover:bg-muted/80 rounded-full flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X size={14} className="text-muted-foreground" />
        </button>

        <div className="flex gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-accent to-accent/70 rounded-xl flex items-center justify-center flex-shrink-0">
            <Download size={24} className="text-accent-foreground" />
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-foreground mb-1">Install MuscleDesk</h3>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">Get faster access and work offline</p>

            <button
              onClick={handleInstall}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-sm py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Install Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
