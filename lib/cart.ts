import { cookies } from "next/headers";

const CART_COOKIE = "suit_cart";

export async function getCartIds() {
  const cookieStore = await cookies();
  const value = cookieStore.get(CART_COOKIE)?.value;

  if (!value) {
    return [];
  }

  return value.split(",").filter(Boolean);
}

export async function addToCart(listingId: string) {
  const cookieStore = await cookies();
  const current = new Set(await getCartIds());
  const alreadyInCart = current.has(listingId);
  current.add(listingId);
  cookieStore.set(CART_COOKIE, Array.from(current).join(","), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  return alreadyInCart;
}

export async function removeFromCart(listingId: string) {
  const cookieStore = await cookies();
  const next = (await getCartIds()).filter((id) => id !== listingId);
  cookieStore.set(CART_COOKIE, next.join(","), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function removeCartItems(listingIds: string[]) {
  const idsToRemove = new Set(listingIds.filter(Boolean));
  const cookieStore = await cookies();
  const next = (await getCartIds()).filter((id) => !idsToRemove.has(id));

  if (next.length === 0) {
    cookieStore.delete(CART_COOKIE);
    return;
  }

  cookieStore.set(CART_COOKIE, next.join(","), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearCart() {
  const cookieStore = await cookies();
  cookieStore.delete(CART_COOKIE);
}
