import { InboxDashboard } from "../../ui/inbox-dashboard";

export default async function InboxPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InboxDashboard token={token} />;
}

