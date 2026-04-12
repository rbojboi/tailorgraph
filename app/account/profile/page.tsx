import Link from "next/link";
import { redirect } from "next/navigation";
import { saveAccountPersonalFieldAction } from "@/app/actions";
import { AppShell, PageWrap, SectionTitle, Select, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeedData } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const publicLocationOptions: Array<[string, string]> = [
  ["city_state_country", "City, State, Country"],
  ["state_country", "State and Country"],
  ["country", "Country Only"]
];

const actionButtonClass =
  "rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950";
const saveButtonClass =
  "rounded-full bg-stone-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-stone-800";
const editButtonClass =
  "rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950";

function EditLink({ href }: { href: string }) {
  return (
    <Link href={href} className={editButtonClass}>
      Edit
    </Link>
  );
}

function formatPublicNamePreference(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const names = [];

  if (user.showPersonalNameOnProfile) {
    names.push("Personal Name");
  }

  if (user.showBusinessNameOnProfile) {
    names.push("Business Name");
  }

  return names.length ? names.join(" + ") : "Username Only";
}

function formatPublicLocationPreference(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  switch (user.publicLocationMode) {
    case "city_state_country":
      return "City, State, Country";
    case "state_country":
      return "State and Country";
    default:
      return "Country Only";
  }
}

export default async function AccountProfilePage({
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
  const saved = firstValue(params.saved);
  const authError = firstValue(params.authError);
  const descriptionValue = user.profileDescription || "User has not added a description.";

  return (
    <AppShell>
      <PageWrap maxWidth="max-w-5xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SectionTitle
                eyebrow="Settings"
                title="Profile Settings"
                description="Manage the name and location details that appear on your public marketplace profile."
              />
            </div>
            <div className="flex shrink-0 items-start gap-3">
              <Link href={`/users/${user.username}`} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900">
                View Profile
              </Link>
              <Link href="/account" className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900">
                Back to Account Settings
              </Link>
            </div>
          </div>
          {authError ? <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p> : null}
          {saved ? <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">Saved {saved}.</p> : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <Spec label="Public Name on Profile" value={formatPublicNamePreference(user)} />
                {field === "publicProfile" ? null : <EditLink href="/account/profile?field=publicProfile" />}
              </div>
              {field === "publicProfile" ? (
                <form action={saveAccountPersonalFieldAction} className="mt-4 grid gap-4">
                  <input type="hidden" name="field" value="publicProfile" />
                  <input type="hidden" name="publicLocationMode" value={user.publicLocationMode} />
                  <label className="rounded-2xl border border-stone-300 bg-white px-4 py-4 text-sm text-stone-700">
                    <span className="flex items-center gap-3">
                      <input
                        name="showPersonalNameOnProfile"
                        type="checkbox"
                        defaultChecked={user.showPersonalNameOnProfile}
                        className="h-4 w-4 shrink-0 rounded border-stone-300"
                      />
                      <span className="font-medium text-stone-900">Show My Personal Name</span>
                    </span>
                  </label>
                  <label className="rounded-2xl border border-stone-300 bg-white px-4 py-4 text-sm text-stone-700">
                    <span className="flex items-center gap-3">
                      <input
                        name="showBusinessNameOnProfile"
                        type="checkbox"
                        defaultChecked={user.showBusinessNameOnProfile}
                        className="h-4 w-4 shrink-0 rounded border-stone-300"
                      />
                      <span className="font-medium text-stone-900">Show My Business Name</span>
                    </span>
                  </label>
                  <p className="text-sm text-stone-600">
                    If both are unchecked, your profile will show only your username.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button className={saveButtonClass}>Save Name Settings</button>
                    <Link href="/account/profile" className={actionButtonClass}>
                      Cancel
                    </Link>
                  </div>
                </form>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <Spec label="Public Location on Profile" value={formatPublicLocationPreference(user)} />
                {field === "locationVisibility" ? null : <EditLink href="/account/profile?field=locationVisibility" />}
              </div>
              {field === "locationVisibility" ? (
                <form action={saveAccountPersonalFieldAction} className="mt-4 grid gap-4">
                  <input type="hidden" name="field" value="publicProfile" />
                  <input type="hidden" name="showPersonalNameOnProfile" value={user.showPersonalNameOnProfile ? "on" : ""} />
                  <input type="hidden" name="showBusinessNameOnProfile" value={user.showBusinessNameOnProfile ? "on" : ""} />
                  <Select
                    name="publicLocationMode"
                    label="Public Location on Profile"
                    defaultValue={user.publicLocationMode}
                    options={publicLocationOptions}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button className={saveButtonClass}>Save Location Settings</button>
                    <Link href="/account/profile" className={actionButtonClass}>
                      Cancel
                    </Link>
                  </div>
                </form>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border border-stone-300 bg-white p-4 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <Spec label="Description" value={descriptionValue} />
                {field === "profileDescription" ? null : <EditLink href="/account/profile?field=profileDescription" />}
              </div>
              {field === "profileDescription" ? (
                <form action={saveAccountPersonalFieldAction} className="mt-4 grid gap-4">
                  <input type="hidden" name="field" value="profileDescription" />
                  <label className="grid gap-2 text-sm text-stone-700">
                    <span className="font-medium text-stone-900">Description (max. 1000 characters)</span>
                    <textarea
                      name="profileDescription"
                      defaultValue={user.profileDescription}
                      maxLength={1000}
                      rows={5}
                      className="min-h-[8rem] rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-950"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button className={saveButtonClass}>Save Description</button>
                    <Link href="/account/profile" className={actionButtonClass}>
                      Cancel
                    </Link>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
