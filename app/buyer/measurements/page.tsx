import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  forceGenerateBuyerMeasurementSuggestionsAction,
  forceSaveBuyerMeasurementCategoryAction,
  forceSaveBuyerProfileAction
} from "@/app/actions";
import { BuyerMeasurementGuide, BuyerProfileForm } from "@/components/buyer-profile-form";
import { BuyerSubpageHeader } from "@/components/buyer-subpage-header";
import { AppShell, PageWrap, Spec } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import type { BuyerProfile } from "@/lib/types";
import { ensureSeedData } from "@/lib/store";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type MeasurementsMode = "setup" | "dashboard";
type SetupPath = "body" | "garment" | "manual";

type MeasurementIssue = {
  message: string;
  suggestion?: string | null;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function renderMeasurementValue(value?: number) {
  return value ? `${value}"` : "Not Saved";
}

function parseOptionalNumberParam(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function parseMeasurementIssues(value: string | undefined): MeasurementIssue[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is MeasurementIssue =>
            typeof entry === "object" &&
            entry !== null &&
            typeof entry.message === "string" &&
            (entry.suggestion === undefined || entry.suggestion === null || typeof entry.suggestion === "string")
        )
      : [];
  } catch {
    return [];
  }
}

function parseMeasurementDraft(value: string | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, entry]) => {
        const numeric = Number(entry);
        return [key, Number.isFinite(numeric) ? numeric : undefined];
      })
    ) as Record<string, number | undefined>;
  } catch {
    return {};
  }
}

function countMeaningfulValues(measurements: Record<string, unknown> | null | undefined) {
  if (!measurements) {
    return 0;
  }

  return Object.entries(measurements).filter(([key, value]) => {
    if (key.endsWith("Allowance")) {
      return false;
    }

    return typeof value === "number" && value > 0;
  }).length;
}

// Default setup/dashboard mode:
// treat the guided flow as onboarding when the profile is still mostly empty,
// and switch to the broader dashboard once the buyer has built out multiple
// meaningful category profiles or already has generated range data to refine.
function resolveDefaultMeasurementsMode(profile: BuyerProfile): MeasurementsMode {
  const categoryCounts = [
    countMeaningfulValues(profile.jacketMeasurements),
    countMeaningfulValues(profile.shirtMeasurements),
    countMeaningfulValues(profile.waistcoatMeasurements),
    countMeaningfulValues(profile.trouserMeasurements),
    countMeaningfulValues(profile.coatMeasurements),
    countMeaningfulValues(profile.sweaterMeasurements)
  ];

  const meaningfulCategoryCount = categoryCounts.filter((count) => count >= 2).length;
  const hasGeneratedRanges = Boolean(
    profile.suggestedMeasurementRanges &&
      [profile.suggestedMeasurementRanges.jacket, profile.suggestedMeasurementRanges.shirt, profile.suggestedMeasurementRanges.waistcoat, profile.suggestedMeasurementRanges.trousers, profile.suggestedMeasurementRanges.coat, profile.suggestedMeasurementRanges.sweater].some(Boolean)
  );

  return meaningfulCategoryCount >= 2 || hasGeneratedRanges ? "dashboard" : "setup";
}

function withMeasurementsQuery(mode: MeasurementsMode, updates: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  params.set("mode", mode);

  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/buyer/measurements?${params.toString()}`;
}

function SetupChoiceCard({
  href,
  title,
  description,
  active
}: {
  href: string;
  title: string;
  description: string;
  active: boolean;
}) {
  const [firstSentence, ...remainingParts] = description.split(". ");
  const secondSentence = remainingParts.join(". ");

  return (
    <Link
      href={href}
      className={`rounded-[1.5rem] border px-5 py-5 transition ${
        active
          ? "border-stone-950 bg-stone-950 text-white"
          : "border-stone-300 bg-white text-stone-950 hover:border-stone-500"
      }`}
    >
      <p className={`text-lg font-semibold ${active ? "text-white" : "text-stone-950"}`}>{title}</p>
      <div className={`mt-2 text-sm leading-6 ${active ? "text-stone-200" : "text-stone-600"}`}>
        <p>{firstSentence}{secondSentence ? "." : ""}</p>
        {secondSentence ? <p className="mt-3">{secondSentence}</p> : null}
      </div>
    </Link>
  );
}

function ModeSwitch({ activeMode }: { activeMode: MeasurementsMode }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href={withMeasurementsQuery("setup", {})}
        className={`rounded-full px-4 py-2 text-sm font-semibold ${
          activeMode === "setup"
            ? "bg-stone-950 text-white"
            : "border border-stone-300 bg-white text-stone-900"
        }`}
      >
        Guided Setup
      </Link>
      <Link
        href={withMeasurementsQuery("dashboard", {})}
        className={`rounded-full px-4 py-2 text-sm font-semibold ${
          activeMode === "dashboard"
            ? "bg-stone-950 text-white"
            : "border border-stone-300 bg-white text-stone-900"
        }`}
      >
        Saved Fit Profile
      </Link>
    </div>
  );
}

function SavedMessage({
  saved,
  activeMode
}: {
  saved?: string;
  activeMode: MeasurementsMode;
}) {
  if (!saved) {
    return null;
  }

  return (
    <div className="mb-4 rounded-[1.5rem] bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>Saved {saved}.</p>
        {activeMode === "setup" ? (
          <Link
            href={withMeasurementsQuery("dashboard", {})}
            className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
          >
            Review Saved Fit Profile
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function MeasurementWarningPanel({
  review,
  issues,
  titleReview,
  titleUnlikely,
  formAction,
  hiddenInputs,
  buttonLabel
}: {
  review?: string;
  issues: MeasurementIssue[];
  titleReview: string;
  titleUnlikely: string;
  formAction: (formData: FormData) => Promise<void>;
  hiddenInputs: Record<string, string>;
  buttonLabel: string;
}) {
  if (!(review === "review" || review === "unlikely") || issues.length === 0) {
    return null;
  }

  return (
    <div
      className={`mb-4 rounded-[1.5rem] border px-4 py-4 text-sm ${
        review === "unlikely"
          ? "border-rose-200 bg-rose-50 text-rose-950"
          : "border-amber-200 bg-amber-50 text-amber-950"
      }`}
    >
      <p className="font-semibold">{review === "unlikely" ? titleUnlikely : titleReview}</p>
      <div className="mt-3 grid gap-3">
        {issues.map((issue, index) => (
          <div
            key={`${issue.message}-${issue.suggestion ?? "none"}`}
            className={index === 0 ? "" : "border-t border-current/15 pt-3"}
          >
            <p>{issue.message}</p>
            {issue.suggestion ? <p className="mt-2 text-stone-700">{issue.suggestion}</p> : null}
          </div>
        ))}
      </div>
      <form action={formAction} className="mt-4">
        {Object.entries(hiddenInputs).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <button className="rounded-full border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900">
          {buttonLabel}
        </button>
      </form>
    </div>
  );
}

function GuidedSetupPanel({
  buyerProfile,
  setupPath,
  measurementInputDefaults,
  buyerMeasurementDraft,
  messages
}: {
  buyerProfile: BuyerProfile;
  setupPath?: SetupPath;
  measurementInputDefaults: {
    height?: number;
    weight?: number;
    bodyChest?: number;
    bodyWaist?: number;
    bodyHips?: number;
    bodyShoulders?: number;
    bodySleeve?: number;
    neck?: number;
    fitPreference?: BuyerProfile["fitPreference"];
    fillMissingOnly?: boolean;
  };
  buyerMeasurementDraft: Record<string, number | undefined>;
  messages?: ReactNode;
}) {
  const baseSetupHref = (path: SetupPath) => withMeasurementsQuery("setup", { setup: path });

  return (
    <section className="panel rounded-[1.75rem] p-6">
      <div className="max-w-3xl">
        <p className="eyebrow text-xs text-stone-500">Guided Setup</p>
        <h2 className="mt-3 text-2xl font-semibold text-stone-950">Choose how you&apos;d like to build your fit profile.</h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          Start with the information you already know. You can always refine, expand, or edit your saved measurements
          from your saved fit profile later.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SetupChoiceCard
          href={baseSetupHref("body")}
          title="Build from body measurements"
          description="Best if you know your height, chest, waist, and shoulders."
          active={setupPath === "body"}
        />
        <SetupChoiceCard
          href={baseSetupHref("garment")}
          title="Build your tailored fit profile from one trusted jacket"
          description="Best if you already own a jacket, and optionally a pair of trousers, that fits exactly how you like."
          active={setupPath === "garment"}
        />
        <SetupChoiceCard
          href={baseSetupHref("manual")}
          title="Enter measurements manually"
          description="Best if you already know the exact garment measurements you want."
          active={setupPath === "manual"}
        />
      </div>

      {messages ? <div className="mt-6">{messages}</div> : null}

      {setupPath === "body" ? (
        <div className="mt-6">
          <BuyerMeasurementGuide
            buyerProfile={buyerProfile}
            returnTo={withMeasurementsQuery("setup", { setup: "body" })}
            inputDefaults={measurementInputDefaults}
            sections="builder"
          />
        </div>
      ) : null}

      {setupPath === "garment" ? (
        <div className="mt-6">
          <BuyerMeasurementGuide
            buyerProfile={buyerProfile}
            returnTo={withMeasurementsQuery("setup", { setup: "garment" })}
            sections="expander"
          />
        </div>
      ) : null}

      {setupPath === "manual" ? (
        <div className="mt-6 rounded-[1.5rem] border border-stone-300 bg-white p-5">
            <div className="max-w-3xl">
            <p className="eyebrow text-xs text-stone-500">Manual Measurements Entry</p>
              <h3 className="mt-3 text-xl font-semibold text-stone-950">Enter your garment measurements directly.</h3>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                Save only the measurements you already know. You can come back later to fill in more categories or use
                the computer-assisted tools to expand your fit profile.
              </p>
            </div>
          <BuyerProfileForm
            buyerProfile={buyerProfile}
            returnTo={withMeasurementsQuery("setup", { setup: "manual" })}
            inputDefaults={buyerMeasurementDraft}
            submitLabel="Save My Measurements"
          />
        </div>
      ) : null}
    </section>
  );
}

function DashboardPanel({
  buyerProfile,
  isEditing,
  buyerMeasurementDraft,
  messages
}: {
  buyerProfile: BuyerProfile;
  isEditing: boolean;
  buyerMeasurementDraft: Record<string, number | undefined>;
  messages?: ReactNode;
}) {
  return (
    <section className="panel rounded-[1.75rem] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p className="eyebrow text-xs text-stone-500">Saved Fit Profile</p>
          <h2 className="mt-3 text-2xl font-semibold text-stone-950">Review and refine your saved fit profile.</h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            Use the accordions below to review the garment measurements currently guiding your TailorGraph Marketplace
            filtering and fit recommendations. Switch into manual edit mode anytime to fine-tune the individual
            categories.
          </p>
        </div>
        {isEditing ? (
          <Link
            href={withMeasurementsQuery("dashboard", {})}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
          >
            Review Saved Profile
          </Link>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href={withMeasurementsQuery("setup", { setup: "body" })}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
            >
              Build from Body Measurements
            </Link>
            <Link
              href={withMeasurementsQuery("setup", { setup: "garment" })}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
            >
              Build from Existing Jacket
            </Link>
          </div>
        )}
      </div>

      {messages ? <div className="mt-6">{messages}</div> : null}

      <div className="mt-6">
        {isEditing ? (
          <div className="rounded-[1.5rem] border border-stone-300 bg-white p-5">
            <div className="max-w-3xl">
              <p className="eyebrow text-xs text-stone-500">Manual Editing</p>
              <h3 className="mt-3 text-2xl font-semibold text-stone-950">Refine your saved measurements directly.</h3>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                Save only the garment measurements you want to keep on profile. Leave anything unknown blank and come
                back later if needed.
              </p>
            </div>
            <BuyerProfileForm
              buyerProfile={buyerProfile}
              cancelHref={withMeasurementsQuery("dashboard", {})}
              returnTo={withMeasurementsQuery("dashboard", { edit: "1" })}
              inputDefaults={buyerMeasurementDraft}
            />
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
            <BuyerProfileForm
              buyerProfile={buyerProfile}
              returnTo={withMeasurementsQuery("dashboard", {})}
              showFooterActions={false}
              topSpacingClass="mt-0"
            />
          </div>
        )}
      </div>
    </section>
  );
}

export default async function BuyerMeasurementsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await ensureSeedData();
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/?authError=Please+log+in+to+access+the+buyer+dashboard");
  }

  const defaultMode = resolveDefaultMeasurementsMode(user.buyerProfile);
  const requestedMode = firstValue(params.mode);
  const activeMode: MeasurementsMode =
    requestedMode === "setup" || requestedMode === "dashboard" ? requestedMode : defaultMode;
  const setupPathValue = firstValue(params.setup);
  const setupPath: SetupPath | undefined =
    setupPathValue === "body" || setupPathValue === "garment" || setupPathValue === "manual"
      ? setupPathValue
      : undefined;
  const isEditing = firstValue(params.edit) === "1";
  const saved = firstValue(params.saved);
  const authError = firstValue(params.authError);

  const measurementReview = firstValue(params.measurementReview);
  const measurementIssues = parseMeasurementIssues(firstValue(params.measurementIssues));
  const buyerMeasurementReview = firstValue(params.buyerMeasurementReview);
  const buyerMeasurementIssues = parseMeasurementIssues(firstValue(params.buyerMeasurementIssues));
  const buyerMeasurementCategorySave = firstValue(params.buyerMeasurementCategorySave);
  const buyerMeasurementDraft = parseMeasurementDraft(firstValue(params.buyerMeasurementDraft));

  const measurementFitPreference = firstValue(params.measurementFitPreference);
  const measurementInputDefaults: {
    height?: number;
    weight?: number;
    bodyChest?: number;
    bodyWaist?: number;
    bodyHips?: number;
    bodyShoulders?: number;
    bodySleeve?: number;
    neck?: number;
    fitPreference?: BuyerProfile["fitPreference"];
    fillMissingOnly?: boolean;
  } = {
    height: parseOptionalNumberParam(firstValue(params.measurementHeight)),
    weight: parseOptionalNumberParam(firstValue(params.measurementWeight)),
    bodyChest: parseOptionalNumberParam(firstValue(params.measurementBodyChest)),
    bodyWaist: parseOptionalNumberParam(firstValue(params.measurementBodyWaist)),
    bodyHips: parseOptionalNumberParam(firstValue(params.measurementBodyHips)),
    bodyShoulders: parseOptionalNumberParam(firstValue(params.measurementBodyShoulders)),
    bodySleeve: parseOptionalNumberParam(firstValue(params.measurementBodySleeve)),
    neck: parseOptionalNumberParam(firstValue(params.measurementNeck)),
    fitPreference:
      measurementFitPreference === "trim" ||
      measurementFitPreference === "classic" ||
      measurementFitPreference === "relaxed"
        ? measurementFitPreference
        : undefined,
    fillMissingOnly: firstValue(params.measurementFillMissingOnly) === "yes"
  };

  const bodyWarningReturnTo = withMeasurementsQuery(activeMode, {
    ...(activeMode === "setup" && setupPath ? { setup: setupPath } : {}),
    ...(activeMode === "dashboard" && isEditing ? { edit: "1" } : {})
  });

  const panelMessages = (
    <>
      {authError ? <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-900">{authError}</p> : null}
      <SavedMessage saved={saved} activeMode={activeMode} />
      <MeasurementWarningPanel
        review={measurementReview}
        issues={measurementIssues}
        titleReview="A few of these body measurements may be worth reviewing before you rely on the generated garment targets."
        titleUnlikely="A few of your body measurements may warrant review to improve the accuracy of your generated fit profile."
        formAction={forceGenerateBuyerMeasurementSuggestionsAction}
        hiddenInputs={{
          returnTo: bodyWarningReturnTo,
          height: firstValue(params.measurementHeight) ?? "",
          weight: firstValue(params.measurementWeight) ?? "",
          bodyChest: firstValue(params.measurementBodyChest) ?? "",
          bodyWaist: firstValue(params.measurementBodyWaist) ?? "",
          bodyHips: firstValue(params.measurementBodyHips) ?? "",
          bodyShoulders: firstValue(params.measurementBodyShoulders) ?? "",
          bodySleeve: firstValue(params.measurementBodySleeve) ?? "",
          neck: firstValue(params.measurementNeck) ?? "",
          fitPreference: firstValue(params.measurementFitPreference) ?? user.buyerProfile.fitPreference,
          fillMissingOnly: firstValue(params.measurementFillMissingOnly) ?? ""
        }}
        buttonLabel="Generate My Measurements Anyway"
      />
      <MeasurementWarningPanel
        review={buyerMeasurementReview}
        issues={buyerMeasurementIssues}
        titleReview="A few of your garment measurements may be worth reviewing before you save them."
        titleUnlikely="A few of your garment measurements may warrant review to improve the accuracy of your saved fit profile."
        formAction={buyerMeasurementCategorySave ? forceSaveBuyerMeasurementCategoryAction : forceSaveBuyerProfileAction}
        hiddenInputs={{
          returnTo: bodyWarningReturnTo,
          buyerMeasurementDraft: firstValue(params.buyerMeasurementDraft) ?? "",
          buyerMeasurementCategorySave: buyerMeasurementCategorySave ?? ""
        }}
        buttonLabel={buyerMeasurementCategorySave ? "Save Category Anyway" : "Save Buyer Measurements Anyway"}
      />
    </>
  );

  return (
    <AppShell>
      <PageWrap>
        <BuyerSubpageHeader
          eyebrow="Buyer Dashboard"
          title="My Measurements"
          content={<ModeSwitch activeMode={activeMode} />}
        />

        {activeMode === "setup" ? (
          <GuidedSetupPanel
            buyerProfile={user.buyerProfile}
            setupPath={setupPath}
            measurementInputDefaults={measurementInputDefaults}
            buyerMeasurementDraft={buyerMeasurementDraft}
            messages={panelMessages}
          />
        ) : (
          <DashboardPanel
            buyerProfile={user.buyerProfile}
            isEditing={isEditing}
            buyerMeasurementDraft={buyerMeasurementDraft}
            messages={panelMessages}
          />
        )}
      </PageWrap>
    </AppShell>
  );
}
