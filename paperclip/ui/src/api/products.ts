import { api } from "./client";

export type ProductAnalyticsStatus = "live" | "repo" | "missing";
export type ProductSiteStatus = "live" | "planned";
export type ProductSiteSource = "runtime_service" | "local_preview" | "missing";

export interface CompanyProductRuntimeServiceSnapshot {
  id: string;
  serviceName: string;
  status: string;
  healthStatus: string;
  port: number | null;
  url: string | null;
}

export interface CompanyProductSnapshot {
  id: string;
  name: string;
  projectId: string;
  projectRef: string;
  projectName: string;
  projectColor: string | null;
  projectLocalFolder: string | null;
  site: {
    name: string;
    title: string | null;
    url: string | null;
    status: ProductSiteStatus;
    source: ProductSiteSource;
    runtimeServices: CompanyProductRuntimeServiceSnapshot[];
  };
  analytics: {
    provider: "umami" | "disabled";
    status: ProductAnalyticsStatus;
    baseUrl: string | null;
    embedUrl: string | null;
    repoPath: string | null;
    installCommand: string;
    databaseCommand: string;
    devCommand: string;
    buildCommand: string;
  };
}

export interface CompanyProductsResponse {
  checkedAt: string;
  umami: {
    status: ProductAnalyticsStatus;
    baseUrl: string | null;
    repoPath: string | null;
  };
  products: CompanyProductSnapshot[];
}

export interface ProductAnalyticsPoint {
  x: string;
  y: number;
}

export interface ProductAnalyticsDashboard {
  status: "live" | "repo" | "missing" | "auth_error" | "site_missing";
  baseUrl: string | null;
  repoPath: string | null;
  website: {
    id: string;
    name: string;
    domain: string;
    shareId?: string | null;
  } | null;
  stats: {
    pageviews: number;
    visitors: number;
    visits: number;
    bounces: number;
    totaltime: number;
    comparison: {
      pageviews: number;
      visitors: number;
      visits: number;
      bounces: number;
      totaltime: number;
    };
  } | null;
  pageviews: {
    pageviews: ProductAnalyticsPoint[];
    sessions: ProductAnalyticsPoint[];
    compare?: {
      pageviews: ProductAnalyticsPoint[];
      sessions: ProductAnalyticsPoint[];
    };
  } | null;
  checkedAt: string;
  message: string | null;
}

export const productsApi = {
  list: (companyId: string) =>
    api.get<CompanyProductsResponse>(`/companies/${encodeURIComponent(companyId)}/products`),
  analytics: (companyId: string, productId: string) =>
    api.get<ProductAnalyticsDashboard>(
      `/companies/${encodeURIComponent(companyId)}/products/${encodeURIComponent(productId)}/analytics`,
    ),
};
