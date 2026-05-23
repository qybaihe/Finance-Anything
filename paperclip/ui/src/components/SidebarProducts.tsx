import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { Link, useLocation } from "@/lib/router";
import { useCompany } from "@/context/CompanyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useSidebar } from "@/context/SidebarContext";
import { productsApi } from "@/api/products";
import { SIDEBAR_SCROLL_RESET_STATE } from "@/lib/navigation-scroll";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { SidebarSection } from "./SidebarSection";

function readActiveProductId(pathname: string, search: string) {
  const routeMatch = pathname.match(/^\/(?:[^/]+\/)?products$/);
  if (!routeMatch) return null;
  return new URLSearchParams(search).get("product");
}

export function SidebarProducts() {
  const [open, setOpen] = useState(true);
  const location = useLocation();
  const { selectedCompanyId } = useCompany();
  const { t } = useLanguage();
  const { isMobile, setSidebarOpen } = useSidebar();
  const activeProductId = useMemo(
    () => readActiveProductId(location.pathname, location.search),
    [location.pathname, location.search],
  );

  const { data } = useQuery({
    queryKey: queryKeys.products.list(selectedCompanyId!),
    queryFn: () => productsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const products = data?.products ?? [];

  if (!selectedCompanyId || products.length === 0) {
    return null;
  }

  return (
    <SidebarSection label={t("Products")} collapsible={{ open, onOpenChange: setOpen }}>
      {products.map((product) => {
        const active = activeProductId === product.id;
        return (
          <Link
            key={product.id}
            to={`/products?product=${encodeURIComponent(product.id)}`}
            state={SIDEBAR_SCROLL_RESET_STATE}
            onClick={() => {
              if (isMobile) setSidebarOpen(false);
            }}
            className={cn(
              "flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-accent text-foreground"
                : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Globe className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{product.name}</span>
            {product.site.status === "live" ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            ) : null}
          </Link>
        );
      })}
    </SidebarSection>
  );
}
