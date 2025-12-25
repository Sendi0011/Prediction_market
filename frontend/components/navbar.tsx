"use client"

import { usePrivy } from "@privy-io/react-auth"
import Link from "next/link"
import { ThemeToggle } from "./theme-toggle"
import { SignUpButton } from "./signupButton"
import { useRouter } from "next/navigation"
import { Button } from "./ui/button"
import { Shield } from "lucide-react"
import { AlertBadge } from "@/components/AlertBadge"

export function Navbar() {
  const { user, login, logout } = usePrivy()
  const router = useRouter()

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent" />
          <span className="text-xl font-bold text-foreground">truthbase</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="/markets" className="text-sm font-medium text-muted-foreground hover:text-foreground transition">
            Markets
          </Link>
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition"
          >
            How It Works
          </Link>
          {user && (
            <Link 
              href="/admin" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition flex items-center gap-1"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}
          <Link href="/alerts" className="flex items-center gap-2">
  <AlertBadge userAddress={user?.wallet?.address} />
  <span>Alerts</span>
</Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Button onClick={() => router.push("/dashboard")} className="bg-primary hover:bg-primary/90">
              Dashboard
            </Button>
          ) : (
            <SignUpButton/>
          )}
        </div>
      </div>
    </nav>
  )
}