import Link from "next/link";
import { redirect } from "next/navigation";
import { saveAccountPersonalFieldAction } from "@/app/actions";
import { AppShell, Input, PageWrap, SectionTitle, Select, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeedData } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const stateTerritoryOptions: Array<[string, string]> = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"], ["AS", "American Samoa"], ["GU", "Guam"],
  ["MP", "Northern Mariana Islands"], ["PR", "Puerto Rico"], ["VI", "U.S. Virgin Islands"]
];

const countryOptions: Array<[string, string]> = [["US", "United States"]];
const actionButtonClass =
  "rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950";
const saveButtonClass =
  "rounded-full bg-stone-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-stone-800";
const editButtonClass =
  "rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950";

function AddressValue({
  line1,
  line2,
  city,
  state,
  country
}: {
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string;
}) {
  return [line1, line2, `${city}, ${state}`, country === "US" ? "United States" : country].filter(Boolean).join(", ");
}

function EditLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={editButtonClass}
    >
      Edit
    </Link>
  );
}

export default async function AccountPersonalPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+access+your+account");
  }

  const field = firstValue(params.field);
  const addressIndex = Number(firstValue(params.index) || "-1");
  const saved = firstValue(params.saved);
  const authError = firstValue(params.authError);
  const baseAddresses =
    user.buyerProfile.addresses.length > 0 ? [...user.buyerProfile.addresses] : [user.buyerProfile.address];
  const addingNewAddress = field === "address" && addressIndex >= baseAddresses.length;
  const addressForForm =
    field === "address" && addressIndex >= 0
      ? baseAddresses[addressIndex] || {
          fullName: user.name,
          line1: "",
          line2: "",
          city: "",
          state: "NY",
          postalCode: "",
          country: "US"
        }
      : null;

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-5xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SectionTitle
                eyebrow="Settings"
                title="Personal Information"
                description="Manage your personal details and saved addresses here."
              />
            </div>
            <Link href="/account" className="shrink-0 self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900">
              Back to Account Settings
            </Link>
          </div>
          {authError ? <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p> : null}
          {saved ? <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">Saved {saved}.</p> : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <Spec label="Name" value={user.name} />
                {field === "name" ? null : <EditLink href="/account/personal?field=name" />}
              </div>
              {field === "name" ? (
                <form action={saveAccountPersonalFieldAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="field" value="name" />
                  <Input name="name" label="Name" type="text" defaultValue={user.name} />
                  <div className="flex flex-wrap gap-3">
                    <button className={saveButtonClass}>Save Name</button>
                    <Link href="/account/personal" className={actionButtonClass}>
                      Cancel
                    </Link>
                  </div>
                </form>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <Spec label="Business Name" value={user.businessName || "Not Saved"} />
                {field === "businessName" ? null : <EditLink href="/account/personal?field=businessName" />}
              </div>
              {field === "businessName" ? (
                <form action={saveAccountPersonalFieldAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="field" value="businessName" />
                  <Input
                    name="businessName"
                    label="Business Name"
                    type="text"
                    defaultValue={user.businessName}
                    placeholder="Optional"
                  />
                  <p className="text-sm text-stone-600">
                    Add a business name if you want to operate publicly under one.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button className={saveButtonClass}>Save Business Name</button>
                    <Link href="/account/personal" className={actionButtonClass}>
                      Cancel
                    </Link>
                  </div>
                </form>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <Spec label="Email" value={user.email} />
                <EditLink href="/account/security/email" />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <Spec label="Phone Number" value={user.phoneNumber || "Not Saved"} />
                {field === "phone" ? null : <EditLink href="/account/personal?field=phone" />}
              </div>
              {field === "phone" ? (
                <form action={saveAccountPersonalFieldAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="field" value="phone" />
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-stone-700">Phone Number</span>
                    <div className="flex items-center rounded-2xl border border-stone-300 bg-white">
                      <span className="border-r border-stone-300 px-4 py-3 text-sm text-stone-700">+1</span>
                      <input
                        name="phoneNumber"
                        type="tel"
                        defaultValue={user.phoneNumber.replace(/^\+1\s*/, "").replace(/\D/g, "")}
                        placeholder="2125551234"
                        inputMode="numeric"
                        maxLength={12}
                        className="w-full rounded-r-2xl bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button className={saveButtonClass}>Save Phone Number</button>
                    <Link href="/account/personal" className={actionButtonClass}>
                      Cancel
                    </Link>
                  </div>
                </form>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <Spec label="Location" value={user.buyerProfile.location || "Not Saved"} />
                {field === "location" ? null : <EditLink href="/account/personal?field=location" />}
              </div>
              {field === "location" ? (
                <form action={saveAccountPersonalFieldAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="field" value="location" />
                  <Input
                    name="buyerZipCode"
                    label="ZIP Code"
                    type="text"
                    defaultValue={user.buyerProfile.zipCode}
                    placeholder="10001"
                    maxLength={5}
                  />
                  <p className="text-sm text-stone-600">Location will update automatically from your ZIP code when you save.</p>
                  <div className="flex flex-wrap gap-3">
                    <button className={saveButtonClass}>Save Location</button>
                    <Link href="/account/personal" className={actionButtonClass}>
                      Cancel
                    </Link>
                  </div>
                </form>
              ) : null}
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-stone-300 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Saved Addresses</p>
                <p className="mt-2 text-sm text-stone-600">Add, update, or remove the addresses attached to your account.</p>
              </div>
              <Link
                href={`/account/personal?field=address&index=${baseAddresses.filter((address) => Boolean(address.line1 || address.city || address.postalCode)).length}`}
                className={actionButtonClass}
              >
                Add Address
              </Link>
            </div>

            {field === "address" && addressForForm ? (
              <div className="mt-4 rounded-[1.5rem] border border-stone-300 bg-stone-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-950">
                    {addingNewAddress ? "Add Address" : `Edit Address ${addressIndex + 1}`}
                  </p>
                  <Link href="/account/personal" className={actionButtonClass}>
                    Cancel
                  </Link>
                </div>
                <form action={saveAccountPersonalFieldAction} className="mt-4 grid gap-4">
                  <input type="hidden" name="field" value="address" />
                  <input type="hidden" name="addressIndex" value={String(addressIndex)} />
                  <input type="hidden" name="addressIntent" value="save" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input name="addressLine1" label="Address Line 1" type="text" defaultValue={addressForForm.line1} />
                    <Input name="addressLine2" label="Address Line 2" type="text" defaultValue={addressForForm.line2} />
                    <Input name="addressCity" label="City" type="text" defaultValue={addressForForm.city} />
                    <Select name="addressState" label="State or Territory" defaultValue={addressForForm.state || "NY"} options={stateTerritoryOptions} />
                    <Input name="addressZipCode" label="ZIP Code" type="text" defaultValue={addressForForm.postalCode} />
                    <Select name="addressCountry" label="Country" defaultValue={addressForForm.country || "US"} options={countryOptions} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button className={saveButtonClass}>{addingNewAddress ? "Save Address" : "Update Address"}</button>
                    {!addingNewAddress && baseAddresses.length > 0 ? (
                      <button
                        formAction={saveAccountPersonalFieldAction}
                        name="addressIntent"
                        value="delete"
                        className="rounded-full border border-[var(--accent)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
                      >
                        Delete Address
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {user.buyerProfile.addresses.length ? (
                  user.buyerProfile.addresses.map((address, index) => (
                    <div key={`saved-address-${index}`} className="rounded-[1.5rem] border border-stone-300 bg-stone-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Spec
                            label={`Saved Address ${index + 1}`}
                            value={AddressValue({
                              line1: address.line1,
                              line2: address.line2,
                              city: address.city,
                              state: address.state,
                              country: address.country
                            }) || "Not Saved"}
                          />
                        </div>
                        <EditLink href={`/account/personal?field=address&index=${index}`} />
                      </div>
                    </div>
                  ))
                ) : (
                  <Spec label="Saved Addresses" value="Not Saved" />
                )}
              </div>
            )}
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
