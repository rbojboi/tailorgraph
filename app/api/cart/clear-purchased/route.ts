import { revalidatePath } from "next/cache";
import { removeCartItems } from "@/lib/cart";

export async function POST(request: Request) {
  let listingIds: string[] = [];

  try {
    const body = (await request.json()) as { listingIds?: unknown };
    listingIds = Array.isArray(body.listingIds)
      ? body.listingIds.map((listingId) => String(listingId)).filter(Boolean)
      : [];
  } catch {
    listingIds = [];
  }

  if (listingIds.length > 0) {
    await removeCartItems(listingIds);
    revalidatePath("/", "layout");
    revalidatePath("/cart");
  }

  return Response.json({ cleared: listingIds.length });
}
