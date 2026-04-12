"use client";

import { useState } from "react";

type ShippingAddress = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

const stateTerritoryOptions: Array<[string, string]> = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"],
  ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"],
  ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"],
  ["WY", "Wyoming"], ["AS", "American Samoa"], ["GU", "Guam"], ["MP", "Northern Mariana Islands"],
  ["PR", "Puerto Rico"], ["VI", "U.S. Virgin Islands"]
];

function addressLabel(address: ShippingAddress) {
  return [
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.postalCode}`.trim(),
    address.country === "US" ? "United States" : address.country
  ]
    .filter(Boolean)
    .join(", ");
}

export function CheckoutAddressFields({
  savedAddresses,
  defaultFullName
}: {
  savedAddresses: ShippingAddress[];
  defaultFullName: string;
}) {
  const hasSavedAddresses = savedAddresses.length > 0;
  const [selection, setSelection] = useState(hasSavedAddresses ? "saved:0" : "new");
  const showNewAddressFields = !hasSavedAddresses || selection === "new";

  return (
    <div className="mt-4 grid gap-3">
      {hasSavedAddresses ? (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-stone-700">Shipping Address</span>
          <select
            name="shippingAddressSelection"
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
          >
            {savedAddresses.map((address, index) => (
              <option key={`saved-address-${index}`} value={`saved:${index}`}>
                {addressLabel(address)}
              </option>
            ))}
            <option value="new">Add a new address</option>
          </select>
        </label>
      ) : (
        <input type="hidden" name="shippingAddressSelection" value="new" />
      )}

      {showNewAddressFields ? (
        <>
          {!hasSavedAddresses ? (
            <div className="rounded-[1.25rem] bg-stone-50 p-3 text-xs text-stone-600">
              You have no saved addresses yet. Add one below and it can be saved to your account.
            </div>
          ) : null}
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-stone-700">Full name</span>
            <input
              name="shippingFullName"
              defaultValue={defaultFullName}
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-stone-700">Address line 1</span>
            <input
              name="shippingLine1"
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-stone-700">Address line 2</span>
            <input
              name="shippingLine2"
              className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">City</span>
              <input
                name="shippingCity"
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">State or Territory</span>
              <select
                name="shippingState"
                defaultValue="NY"
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
              >
                {stateTerritoryOptions.map(([value, label]) => (
                  <option key={`state-${value}`} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">ZIP code</span>
              <input
                name="shippingPostalCode"
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Country</span>
              <input
                name="shippingCountry"
                defaultValue="US"
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="saveAddressToAccount" value="yes" className="h-4 w-4 shrink-0 rounded border-stone-300" />
            Save this address to my account
          </label>
        </>
      ) : null}
    </div>
  );
}
