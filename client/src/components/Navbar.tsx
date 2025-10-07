import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle, LayoutDashboard, LogOut, MapPin } from "lucide-react";

interface NavbarProps {
  user?: {
    name: string;
    role: string;
  } | null;
  onLogout?: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const [location] = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl supports-[backdrop-filter]:bg-black/40">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" data-testid="link-home">
            <div className="flex items-center gap-2 hover-elevate px-3 py-2 rounded-md cursor-pointer">
              <Activity className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">LifeLink AI</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link href="/dashboard" data-testid="link-dashboard">
                  <Button
                    variant={location === "/dashboard" ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>

                {user.role === "admin" && (
                  <Link href="/admin" data-testid="link-admin">
                    <Button
                      variant={location === "/admin" ? "default" : "ghost"}
                      size="sm"
                      className="gap-2"
                    >
                      <MapPin className="h-4 w-4" />
                      Admin
                    </Button>
                  </Link>
                )}

                <Link href="/sos" data-testid="link-sos">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2 animate-pulse-soft"
                  >
                    <AlertCircle className="h-4 w-4" />
                    SOS
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="gap-2"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" data-testid="link-login">
                  <Button variant="outline" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/signup" data-testid="link-signup">
                  <Button variant="default" size="sm">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
