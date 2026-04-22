import ResearchPage from "../research/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Dashboard default landing = research workbench. Other tabs (overview,
// activity, earnings) are sub-routes with their own pages but share the
// sidebar layout defined in dashboard/layout.tsx.
export default function DashboardRoot() {
  return <ResearchPage />;
}
