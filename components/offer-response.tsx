import { respondToOfferAction } from "@/app/offers/actions";
import { buyNowAction } from "@/app/actions";
import type { Offer } from "@/lib/types";

export function OfferResponse({offer,userId}:{offer:Offer;userId:string}) {
  const expired=offer.expiresAt && new Date(offer.expiresAt)<=new Date();
  if (expired) return <p className="mt-3 text-sm text-stone-600">This offer has expired.</p>;
  if (offer.status==="accepted") return <div className="mt-3 text-sm text-stone-700"><p>Accepted. Payment is still required; this item remains available until purchased. The agreed price applies automatically at checkout until this offer expires.</p>{userId===offer.buyerId?<form action={buyNowAction}><input type="hidden" name="listingId" value={offer.listingId}/><button className="mt-3 rounded-full bg-stone-950 px-4 py-2 text-white">Buy at agreed price</button></form>:null}</div>;
  if (!["active","countered"].includes(offer.status)) return null;
  if ((offer.lastActorId??offer.buyerId)===userId) return <p className="mt-3 text-sm text-stone-600">Waiting for a response.</p>;
  return <form action={respondToOfferAction} className="mt-4 flex flex-wrap items-center gap-3">
    <input type="hidden" name="offerId" value={offer.id}/><input type="hidden" name="revision" value={offer.revision??0}/><input type="hidden" name="destination" value={userId===offer.sellerId?"seller":"buyer"}/>
    <button name="decision" value="accept" className="rounded-full bg-stone-950 px-4 py-2 text-sm text-white">Accept</button>
    <button name="decision" value="decline" className="rounded-full border px-4 py-2 text-sm">Decline</button>
    <label className="text-sm">Counteroffer ($) <input name="amount" type="number" min="0.50" max="100000" step="0.01" className="w-28 rounded-lg border px-2 py-2"/></label>
    <button name="decision" value="counter" className="rounded-full border px-4 py-2 text-sm">Counter</button>
  </form>;
}
