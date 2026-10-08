import React, { useState } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import BankrollSwitcher from "@/components/BankrollSwitcher";
import {
  LayoutDashboard,
  ListChecks,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  TrendingUp,
  Menu,
  X,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Vezérlőpult", icon: LayoutDashboard, end: true, id: "dashboard" },
  { to: "/fogadasok", label: "Fogadások", icon: ListChecks, id: "bets" },
  { to: "/elemzes", label: "Elemzés", icon: BarChart3, id: "analytics" },
  { to: "/beallitasok", label: "Beállítások", icon: SettingsIcon, id: "settings" },
];

function NavItems({ onNavigate }) {
  return (
    <>
      {NAV.map((n) => {
        const Icon = n.icon;
        return (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={onNavigate}
            data-testid={`sidebar-nav-${n.id}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
              }`
            }
          >
            <Icon size={18} />
            {n.label}
          </NavLink>
        );
      })}
    </>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/belepes");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 bg-[#050505] border-r border-white/[0.06] p-5 z-30">
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-[#00E676] flex items-center justify-center">
            <TrendingUp size={20} className="text-black" />
          </div>
          <div className="leading-tight">
            <div className="font-head font-bold text-white tracking-tight">Bet Tracker</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">PRO v4</div>
          </div>
        </div>
        <BankrollSwitcher />
        <nav className="flex flex-col gap-1 flex-1">
          <NavItems />
        </nav>
        <div className="border-t border-white/[0.06] pt-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-xs font-bold text-white overflow-hidden">
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-full h-full object-cover" />
              ) : (
                (user?.name || user?.email || "?").charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-white truncate">{user?.name || "Felhasználó"}</div>
              <div className="text-[11px] text-zinc-500 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-button"
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-loss hover:bg-white/[0.03] transition-colors duration-200"
          >
            <LogOut size={18} />
            Kijelentkezés
          </button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-black/60 backdrop-blur-2xl border-b border-white/[0.05] flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00E676] flex items-center justify-center">
            <TrendingUp size={16} className="text-black" />
          </div>
          <span className="font-head font-bold text-white text-sm">Bet Tracker Pro</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          data-testid="mobile-menu-button"
          className="text-white p-2"
        >
          <Menu size={22} />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          >
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="w-72 h-full bg-[#050505] border-r border-white/[0.06] p-5 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <span className="font-head font-bold text-white">Menü</span>
                <button onClick={() => setMobileOpen(false)} className="text-zinc-400 p-1">
                  <X size={20} />
                </button>
              </div>
              <BankrollSwitcher />
              <nav className="flex flex-col gap-1 flex-1">
                <NavItems onNavigate={() => setMobileOpen(false)} />
              </nav>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-400 hover:text-loss transition-colors"
              >
                <LogOut size={18} />
                Kijelentkezés
              </button>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
