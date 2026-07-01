import { PortalTabBar } from "@/components/PortalTabBar";
import { PWARegister } from "@/components/PWARegister";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Registers the service worker + surfaces the install prompt on ANY portal
          route (F3 audit fix — previously only on the home page). */}
      <div className="mx-auto max-w-md px-5 pt-4"><PWARegister /></div>
      {children}
      <PortalTabBar />
    </>
  );
}
