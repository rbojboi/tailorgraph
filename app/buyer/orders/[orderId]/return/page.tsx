import { ReturnDetail } from "@/components/return-detail";
export default async function Page({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const [route, query] = await Promise.all([params, searchParams]);
  return <ReturnDetail orderId={route.orderId} role="buyer" error={query.error} saved={query.saved}/>;
}
