type OfferEvent = {status:string;autoCharge?:boolean;paymentState?:string;actorId:string;buyerId:string;amount:number};

export function offerEmailCopy(event:OfferEvent,title:string,isBuyer:boolean,paidTotal?:number) {
  const item=`${title}: $${Number(event.amount).toFixed(2)}.`;
  if(event.autoCharge && event.status==="accepted") {
    if(event.paymentState==="paid") return {
      subject:isBuyer?"Offer accepted — purchase confirmed":"Offer accepted — payment received",
      text:isBuyer?`${item} Your payment of $${Number(paidTotal).toFixed(2)}, including shipping, is complete. The seller will prepare your order. You can follow shipping updates in My Purchases.`:
        `${item} The buyer's payment of $${Number(paidTotal).toFixed(2)}, including shipping, is complete. Please prepare the order and ship by the deadline shown in your orders.`,
      button:isBuyer?"View purchase":"View order"
    };
    if(event.paymentState==="needs_payment") return {
      subject:isBuyer?"Offer accepted — complete your payment":"Offer accepted — awaiting buyer payment",
      text:isBuyer?`${item} We couldn't complete the automatic payment. Your card may need verification or a different payment method. Open your offers to complete payment before the displayed reservation deadline. Your purchase is confirmed only after payment succeeds.`:
        `${item} The automatic payment needs the buyer's attention. The item is reserved while the buyer completes payment. Please wait for a payment confirmation before shipping.`,
      button:isBuyer?"Complete payment":"View offer"
    };
    return {subject:"Offer accepted — payment processing",text:`${item} We are processing the authorized payment, including shipping. ${isBuyer?"Your purchase will be confirmed when payment succeeds.":"Please wait for a payment confirmation before shipping."}`,button:"View offer"};
  }
  const label=event.status==="active"?"New offer":event.status==="countered"?"Counteroffer":`Offer ${event.status==="rejected"?"declined":event.status}`;
  let detail=event.status==="accepted"?"Payment is still required. The buyer can check out at the agreed price within seven days, while the item remains available.":
    event.status==="expired"?"The response or payment window has ended.":event.status==="rejected"?"This offer was declined. No further response is needed.":"Visit your offers to review and respond.";
  if(event.autoCharge && ["active","countered"].includes(event.status)) detail=isBuyer?
    "Review the counteroffer and its total, including shipping. Accepting requires your payment authorization and starts payment automatically.":
    "The buyer has authorized payment of this offer plus the quoted shipping. Accepting starts payment automatically. A counteroffer requires the buyer's approval of the new total.";
  if(event.autoCharge && event.paymentState==="canceled") detail="The payment window ended without a completed purchase. The item is available again if it has not since sold. Review the current listing before making another offer.";
  return {subject:label,text:`${item} ${detail}`,button:event.status==="rejected"||event.status==="expired"?"View offer":"Review offer"};
}
