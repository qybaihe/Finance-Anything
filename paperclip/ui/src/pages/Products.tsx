import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  FileText,
  Package2,
  RefreshCw,
  ShieldCheck,
  SquareTerminal,
} from "lucide-react";
import { useSearchParams } from "@/lib/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { useLanguage } from "@/context/LanguageContext";
import { productsApi, type CompanyProductSnapshot } from "@/api/products";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

function statusBadgeClass(status: "live" | "planned" | string) {
  switch (status) {
    case "live":
    case "running":
    case "healthy":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "planned":
      return "bg-slate-500/10 text-slate-700 dark:text-slate-300";
    case "stopped":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "failed":
    case "unhealthy":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function ProductHero({ product, siteActionUrl }: { product: CompanyProductSnapshot; siteActionUrl: string | null }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4 shadow-xs">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("border-0", statusBadgeClass(product.site.status))}>
              {siteActionUrl ? "报告已接入" : "报告待接入"}
            </Badge>
            <Badge variant="outline">项目 · {product.projectName}</Badge>
            <Badge variant="outline">监控路径已关闭</Badge>
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{product.name}</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              产品端现在以完整 HTML 财务规划报告为主入口。Umami / Analytics 不再作为默认页面，也不会自动注册网站或创建监控路径。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {siteActionUrl ? (
            <Button asChild size="sm">
              <a href={siteActionUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                打开完整报告
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReportPreview({ product, siteActionUrl }: { product: CompanyProductSnapshot; siteActionUrl: string | null }) {
  return (
    <div className="rounded-2xl border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-medium">HTML 财务规划报告</h2>
            <p className="text-xs text-muted-foreground">
              {product.site.title ?? product.site.name ?? "KidCompass family financial planning report"}
            </p>
          </div>
        </div>
        {siteActionUrl ? <Badge variant="outline" className="font-mono">{siteActionUrl}</Badge> : null}
      </div>

      {siteActionUrl ? (
        <div className="h-[72vh] min-h-[620px] overflow-hidden rounded-b-2xl bg-background">
          <iframe
            title={`${product.name} HTML report`}
            src={siteActionUrl}
            className="h-full w-full border-0 bg-white"
          />
        </div>
      ) : (
        <div className="px-4 py-16">
          <EmptyState icon={FileText} message="这个产品还没有接入 HTML 报告。请先让 HTML报告生成 Agent 在项目子路径生成正式报告并注册运行服务。" />
        </div>
      )}
    </div>
  );
}

function RuntimeServices({ product }: { product: CompanyProductSnapshot }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4 shadow-xs">
      <div className="flex items-center gap-2">
        <SquareTerminal className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">运行服务</h2>
      </div>
      <div className="mt-3 space-y-2">
        {product.site.runtimeServices.length > 0 ? (
          product.site.runtimeServices.map((service) => (
            <div key={service.id} className="rounded-xl border bg-background/70 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{service.serviceName}</div>
                <Badge className={cn("border-0", statusBadgeClass(service.status))}>{service.status}</Badge>
              </div>
              <div className="mt-1 break-all text-xs text-muted-foreground">
                {service.url ?? service.port ?? "No port"}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
            还没有运行服务绑定到这个产品。
          </div>
        )}
      </div>
    </div>
  );
}

function MaintenanceNotes() {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4 shadow-xs">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">报告生成规则</h2>
      </div>
      <div className="mt-3 space-y-3 text-sm text-muted-foreground">
        <p>HTML报告生成 Agent 是报告唯一生产者；产品端只挂载它在项目子路径下生成的正式产物。</p>
        <p>当教育金、保险或风控 Agent 更新结论时，HTML报告生成 Agent 应同步重生成报告版本，并保留变更说明。</p>
      </div>
    </div>
  );
}

function ComplianceNotes() {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4 shadow-xs">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">合规提示</h2>
      </div>
      <div className="mt-3 space-y-3 text-sm text-muted-foreground">
        <p>HTML 报告只提供规划框架与行动清单，不直接推荐具体金融产品。</p>
        <p>保险、投资、税务、传承等持牌领域必须由持牌顾问确认后才能执行。</p>
      </div>
    </div>
  );
}

export function Products() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    setBreadcrumbs([{ label: t("Products") }]);
  }, [setBreadcrumbs, t]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.products.list(selectedCompanyId!),
    queryFn: () => productsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const products = data?.products ?? [];
  const requestedProductId = searchParams.get("product");
  const activeProduct = useMemo(
    () => products.find((product) => product.id === requestedProductId) ?? products[0] ?? null,
    [products, requestedProductId],
  );
  const siteActionUrl = activeProduct?.site.url ?? null;

  useEffect(() => {
    if (!activeProduct) return;
    if (requestedProductId === activeProduct.id) return;
    const next = new URLSearchParams(searchParams);
    next.set("product", activeProduct.id);
    setSearchParams(next, { replace: true });
  }, [activeProduct, requestedProductId, searchParams, setSearchParams]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Package2} message="请选择公司后查看产品报告。" />;
  }

  if (isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  if (products.length === 0 || !activeProduct) {
    return <EmptyState icon={Package2} message="还没有产品报告。创建项目或接入 HTML 报告后会显示在这里。" />;
  }

  return (
    <div className="min-h-[calc(100vh-11rem)] space-y-4">
      <div className="rounded-2xl border bg-card px-4 py-3 shadow-xs">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Package2 className="h-4 w-4 text-muted-foreground" />
              <h1 className="text-sm font-medium">产品</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              这里集中展示可交付给家庭的 HTML 财务规划报告；分析/监控路径已关闭。
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {products.length > 1 ? (
              <Select
                value={activeProduct.id}
                onValueChange={(value) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("product", value);
                  setSearchParams(next);
                }}
              >
                <SelectTrigger className="min-w-[16rem] max-w-full">
                  <SelectValue placeholder="选择产品" />
                </SelectTrigger>
                <SelectContent align="end">
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>
      </div>

      <ProductHero product={activeProduct} siteActionUrl={siteActionUrl} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ReportPreview product={activeProduct} siteActionUrl={siteActionUrl} />
        <div className="space-y-4">
          <RuntimeServices product={activeProduct} />
          <MaintenanceNotes />
          <ComplianceNotes />
        </div>
      </div>
    </div>
  );
}
