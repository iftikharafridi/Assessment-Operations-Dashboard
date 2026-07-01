import { computeDashboardMetrics } from "../analytics/dashboard.js";

/** Extended KPI metrics for dashboard cards. */
export function computeExtendedDashboardMetrics(project) {
  return computeDashboardMetrics(project);
}
