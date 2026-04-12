import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type {
  BuyerProfile,
  JacketMeasurements,
  JacketSpecs,
  Listing,
  ListingMedia,
  ListingStatus,
  Message,
  MessageThread,
  Offer,
  OfferStatus,
  Order,
  OrderReview,
  OrderStatus,
  PublicLocationMode,
  Role,
  SavedSearch,
  SellerReviewScores,
  ShirtSpecs,
  ShippingAddress,
  SweaterSpecs,
  TrouserMeasurements,
  TrouserSpecs,
  User,
  WaistcoatMeasurements,
  WaistcoatSpecs
} from "@/lib/types";

const emptyShippingAddress: ShippingAddress = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US"
};

const defaultBuyerProfile: BuyerProfile = {
  zipCode: "",
  location: "",
  address: emptyShippingAddress,
  addresses: [],
  height: 71,
  weight: 180,
  chest: 40,
  shoulder: 18,
  waist: 34,
  sleeve: 34,
  neck: 15.5,
  inseam: 31,
  fitPreference: "classic",
  maxAlterationBudget: 120,
  searchRadius: 30,
  jacketMeasurements: null,
  shirtMeasurements: null,
  waistcoatMeasurements: null,
  trouserMeasurements: null,
  coatMeasurements: null,
  sweaterMeasurements: null,
  suggestedMeasurementRanges: null
};

const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = Boolean(databaseUrl);
const SCHEMA_VERSION = 29;

const globalForPg = globalThis as unknown as {
  tailorGraphPool?: Pool;
  tailorGraphSchemaReady?: Promise<void>;
  tailorGraphSchemaVersion?: number;
};

function normalizeVintageEra(value: unknown): Listing["vintage"] {
  if (value === true || value === "true") {
    return "vintage_1970_2000";
  }

  if (value === false || value === "false" || value === null || value === undefined || value === "") {
    return "modern";
  }

  if (
    value === "modern" ||
    value === "vintage_1970_2000" ||
    value === "vintage_1940_1970" ||
    value === "vintage_pre_1940"
  ) {
    return value;
  }

  return "modern";
}

function normalizeStoredSizeLabel(value: string) {
  return value.replace(/[X×]/g, "x");
}

function normalizeUsernameCandidate(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

async function generateAvailableUsername(baseValue: string, excludeUserId?: string) {
  const client = requirePool();
  const base = normalizeUsernameCandidate(baseValue) || "user";
  let candidate = base;
  let suffix = 1;

  while (true) {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE username = $1 ${excludeUserId ? "AND id <> $2" : ""} LIMIT 1`,
      excludeUserId ? [candidate, excludeUserId] : [candidate]
    );

    if (!result.rows[0]) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}

const pool =
  !databaseConfigured
    ? null
    : globalForPg.tailorGraphPool ??
      new Pool({
        connectionString: databaseUrl,
        keepAlive: true
      });

if (pool && !globalForPg.tailorGraphPool) {
  globalForPg.tailorGraphPool = pool;
}

if (pool) {
  pool.on("error", () => {
    // Allow the next query to establish a fresh connection if the current one is reset.
  });
}

function requirePool() {
  if (!pool) {
    throw new Error("DATABASE_URL is required. Set it to your hosted Postgres connection string.");
  }

  return pool;
}

function isRetryableDatabaseError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /ECONNRESET|Connection terminated unexpectedly|Client has encountered a connection error/i.test(error.message);
}

async function queryWithRetry<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  attempts = 2
) {
  const client = requirePool();
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await client.query<T>(text, params);
    } catch (error) {
      lastError = error;

      if (!isRetryableDatabaseError(error) || attempt === attempts) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Database query failed");
}

async function initSchema() {
  const client = requirePool();
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE,
      business_name TEXT NOT NULL DEFAULT '',
      profile_description TEXT NOT NULL DEFAULT '',
      public_name_mode TEXT NOT NULL DEFAULT 'username',
      show_personal_name_on_profile BOOLEAN NOT NULL DEFAULT FALSE,
      show_business_name_on_profile BOOLEAN NOT NULL DEFAULT FALSE,
      public_location_mode TEXT NOT NULL DEFAULT 'country',
      email TEXT NOT NULL UNIQUE,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      phone_number TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      seller_zip_code TEXT NOT NULL DEFAULT '',
      seller_location TEXT NOT NULL DEFAULT '',
      marketplace_intro_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
      stripe_account_id TEXT,
      stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS buyer_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      zip_code TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      address JSONB NOT NULL DEFAULT '{}'::jsonb,
      addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
      height DOUBLE PRECISION NOT NULL,
      weight DOUBLE PRECISION NOT NULL DEFAULT 180,
      chest DOUBLE PRECISION NOT NULL,
      shoulder DOUBLE PRECISION NOT NULL,
      waist DOUBLE PRECISION NOT NULL,
      sleeve DOUBLE PRECISION NOT NULL,
      neck DOUBLE PRECISION NOT NULL DEFAULT 15.5,
      inseam DOUBLE PRECISION NOT NULL,
      fit_preference TEXT NOT NULL DEFAULT 'classic',
      max_alteration_budget DOUBLE PRECISION NOT NULL,
      search_radius DOUBLE PRECISION NOT NULL,
      jacket_measurements JSONB,
      shirt_measurements JSONB,
      waistcoat_measurements JSONB,
      trouser_measurements JSONB,
      coat_measurements JSONB,
      sweater_measurements JSONB,
      suggested_measurement_ranges JSONB
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_display_name TEXT NOT NULL,
      title TEXT NOT NULL,
      brand TEXT NOT NULL,
      category TEXT NOT NULL,
      size_label TEXT NOT NULL,
      trouser_size_label TEXT NOT NULL DEFAULT '',
      chest DOUBLE PRECISION NOT NULL,
      shoulder DOUBLE PRECISION NOT NULL,
      waist DOUBLE PRECISION NOT NULL,
      sleeve DOUBLE PRECISION NOT NULL,
      inseam DOUBLE PRECISION NOT NULL,
      outseam DOUBLE PRECISION NOT NULL,
      material TEXT NOT NULL,
      pattern TEXT NOT NULL,
      primary_color TEXT NOT NULL DEFAULT 'navy',
      country_origin TEXT NOT NULL DEFAULT 'unknown',
      lapel TEXT NOT NULL,
      fabric_weight TEXT NOT NULL DEFAULT 'medium',
      fabric_type TEXT NOT NULL DEFAULT 'na',
      fabric_weave TEXT NOT NULL DEFAULT 'na',
      condition TEXT NOT NULL,
      vintage TEXT NOT NULL DEFAULT 'modern',
      returns_accepted BOOLEAN NOT NULL DEFAULT FALSE,
      allow_offers BOOLEAN NOT NULL DEFAULT TRUE,
      price DOUBLE PRECISION NOT NULL,
      shipping_price DOUBLE PRECISION NOT NULL DEFAULT 0,
      shipping_included BOOLEAN NOT NULL DEFAULT TRUE,
      shipping_method TEXT NOT NULL DEFAULT 'ship',
      processing_days INTEGER NOT NULL DEFAULT 3,
      location TEXT NOT NULL,
      distance_miles DOUBLE PRECISION NOT NULL,
      description TEXT NOT NULL,
      media JSONB NOT NULL DEFAULT '[]'::jsonb,
      jacket_measurements JSONB,
      jacket_specs JSONB,
      waistcoat_measurements JSONB,
      waistcoat_specs JSONB,
      trouser_measurements JSONB,
      trouser_specs JSONB,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buyer_name TEXT NOT NULL,
      seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_name TEXT NOT NULL,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      listing_title TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
      shipping_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL,
      stripe_checkout_session_id TEXT,
      stripe_payment_intent_id TEXT,
      shipping_full_name TEXT,
      shipping_line1 TEXT,
      shipping_line2 TEXT,
      shipping_city TEXT,
      shipping_state TEXT,
      shipping_postal_code TEXT,
      shipping_country TEXT,
      shipping_method TEXT NOT NULL DEFAULT 'ship',
      carrier TEXT,
      tracking_number TEXT,
      tracking_url TEXT,
      tracking_status TEXT,
      shipping_eta TIMESTAMPTZ,
      shipping_label_url TEXT,
      shipping_provider TEXT,
      shipping_provider_shipment_id TEXT,
      shipping_provider_rate_id TEXT,
      shipping_provider_transaction_id TEXT,
      issue_reason TEXT,
      seller_notes TEXT,
      shipped_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS message_threads (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
      order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
      subject TEXT NOT NULL,
      last_message_sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      buyer_last_read_at TIMESTAMPTZ,
      seller_last_read_at TIMESTAMPTZ,
      buyer_deleted_at TIMESTAMPTZ,
      seller_deleted_at TIMESTAMPTZ,
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_follows (
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, followed_id)
    );

    CREATE TABLE IF NOT EXISTS user_saved_listings (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, listing_id)
    );

    CREATE TABLE IF NOT EXISTS user_saved_searches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      query_string TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_reviews (
      order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      overall_rating INTEGER,
      measurement_rating INTEGER,
      condition_rating INTEGER,
      item_rating INTEGER,
      shipping_rating INTEGER,
      communication_rating INTEGER,
      feedback TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notification_deliveries (
      event_key TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      event_type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS message_threads_listing_unique
      ON message_threads (buyer_id, seller_id, listing_id)
      WHERE listing_id IS NOT NULL AND order_id IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS message_threads_order_unique
      ON message_threads (order_id)
      WHERE order_id IS NOT NULL;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_zip_code TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_location TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_description TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS public_name_mode TEXT NOT NULL DEFAULT 'username';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS show_personal_name_on_profile BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS show_business_name_on_profile BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS public_location_mode TEXT NOT NULL DEFAULT 'country';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS marketplace_intro_dismissed BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS zip_code TEXT NOT NULL DEFAULT '';
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '';
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS address JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS addresses JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS weight DOUBLE PRECISION NOT NULL DEFAULT 180;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS neck DOUBLE PRECISION NOT NULL DEFAULT 15.5;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS fit_preference TEXT NOT NULL DEFAULT 'classic';
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS fabric_weight TEXT NOT NULL DEFAULT 'medium';
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS fabric_type TEXT NOT NULL DEFAULT 'na';
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS fabric_weave TEXT NOT NULL DEFAULT 'na';
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS trouser_size_label TEXT NOT NULL DEFAULT '';
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT 'navy';
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS country_origin TEXT NOT NULL DEFAULT 'unknown';
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS vintage TEXT NOT NULL DEFAULT 'modern';
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS returns_accepted BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS allow_offers BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS jacket_measurements JSONB;
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS jacket_specs JSONB;
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS waistcoat_measurements JSONB;
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS waistcoat_specs JSONB;
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS trouser_measurements JSONB;
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS trouser_specs JSONB;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS jacket_measurements JSONB;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS shirt_measurements JSONB;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS waistcoat_measurements JSONB;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS trouser_measurements JSONB;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS coat_measurements JSONB;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS sweater_measurements JSONB;
    ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS suggested_measurement_ranges JSONB;
    ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS last_message_sender_id TEXT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS buyer_last_read_at TIMESTAMPTZ;
    ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS seller_last_read_at TIMESTAMPTZ;
    ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS buyer_deleted_at TIMESTAMPTZ;
    ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS seller_deleted_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_status TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_eta TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_label_url TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_provider TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_provider_shipment_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_provider_rate_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_provider_transaction_id TEXT;
    ALTER TABLE order_reviews ADD COLUMN IF NOT EXISTS measurement_rating INTEGER;
    ALTER TABLE order_reviews ADD COLUMN IF NOT EXISTS condition_rating INTEGER;
  `);

  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'listings'
          AND column_name = 'vintage'
          AND data_type = 'boolean'
      ) THEN
        ALTER TABLE listings
        ALTER COLUMN vintage TYPE TEXT
        USING CASE WHEN vintage THEN 'vintage_1970_2000' ELSE 'modern' END;
      END IF;
    END $$;

    ALTER TABLE listings ALTER COLUMN vintage SET DEFAULT 'modern';

    UPDATE listings
    SET vintage = CASE
      WHEN vintage IN ('true', 'yes', 'pre_2000') THEN 'vintage_1970_2000'
      WHEN vintage IN ('false', 'no', '') THEN 'modern'
      ELSE vintage
    END;
  `);

  await client.query(`
    UPDATE order_reviews
    SET measurement_rating = item_rating
    WHERE measurement_rating IS NULL AND item_rating IS NOT NULL
  `);

  const usersMissingUsername = await client.query<{ id: string; name: string; email: string }>(
    "SELECT id, name, email FROM users WHERE username IS NULL OR username = ''"
  );

  for (const row of usersMissingUsername.rows) {
    const fallbackBase = normalizeUsernameCandidate(row.name) || normalizeUsernameCandidate(row.email.split("@")[0]) || "user";
    const username = fallbackBase === "bobbyveebee" ? "bobbyveebee" : await generateAvailableUsername(fallbackBase, row.id);
    await client.query("UPDATE users SET username = $1 WHERE id = $2", [username, row.id]);
  }

  await client.query(`
    UPDATE listings
    SET seller_display_name = users.username
    FROM users
    WHERE users.id = listings.seller_id
      AND COALESCE(users.username, '') <> ''
      AND listings.seller_display_name <> users.username
  `);

  await client.query("UPDATE users SET role = 'both' WHERE role <> 'both'");

  await client.query(
    `UPDATE users
     SET username = 'bobbyveebee'
     WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) = 'bobbyveebee'
       AND (username IS NULL OR username = '' OR username = 'bobbyveebee2')`
  );

  await client.query(`
    UPDATE users
    SET
      show_personal_name_on_profile = CASE WHEN public_name_mode = 'name' THEN TRUE ELSE show_personal_name_on_profile END,
      show_business_name_on_profile = CASE WHEN public_name_mode = 'business_name' THEN TRUE ELSE show_business_name_on_profile END
    WHERE public_name_mode IN ('name', 'business_name')
  `);

  await client.query(`
    UPDATE users
    SET public_location_mode = 'country'
    WHERE public_location_mode IS NULL OR public_location_mode = '' OR public_location_mode = 'city_state_country'
  `);

  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users (username)");
}

async function ensureSchema() {
  if (!databaseConfigured) {
    return;
  }

  if (!globalForPg.tailorGraphSchemaReady || globalForPg.tailorGraphSchemaVersion !== SCHEMA_VERSION) {
    globalForPg.tailorGraphSchemaReady = initSchema();
    globalForPg.tailorGraphSchemaVersion = SCHEMA_VERSION;
  }

  await globalForPg.tailorGraphSchemaReady;
}

function mapUser(row: Record<string, unknown>): User {
  const address =
    typeof row.address === "string"
      ? ({ ...emptyShippingAddress, ...(JSON.parse(row.address) as Partial<ShippingAddress>) } as ShippingAddress)
      : ({ ...emptyShippingAddress, ...((row.address as Partial<ShippingAddress> | null) ?? {}) } as ShippingAddress);
  const addresses =
    typeof row.addresses === "string"
      ? (JSON.parse(row.addresses) as Partial<ShippingAddress>[])
      : ((row.addresses as Partial<ShippingAddress>[] | null) ?? []);
  const normalizedAddresses = addresses
    .map((entry) => ({ ...emptyShippingAddress, ...entry }))
    .filter((entry) => entry.line1 || entry.city || entry.state || entry.postalCode);
  const jacketMeasurements =
    typeof row.jacket_measurements === "string"
      ? (JSON.parse(row.jacket_measurements) as JacketMeasurements | null)
      : (row.jacket_measurements as JacketMeasurements | null) ?? null;
  const shirtMeasurements =
    typeof row.shirt_measurements === "string"
      ? (JSON.parse(row.shirt_measurements) as JacketMeasurements | null)
      : (row.shirt_measurements as JacketMeasurements | null) ?? null;
  const waistcoatMeasurements =
    typeof row.waistcoat_measurements === "string"
      ? (JSON.parse(row.waistcoat_measurements) as WaistcoatMeasurements | null)
      : (row.waistcoat_measurements as WaistcoatMeasurements | null) ?? null;
  const trouserMeasurements =
    typeof row.trouser_measurements === "string"
      ? (JSON.parse(row.trouser_measurements) as TrouserMeasurements | null)
      : (row.trouser_measurements as TrouserMeasurements | null) ?? null;
  const coatMeasurements =
    typeof row.coat_measurements === "string"
      ? (JSON.parse(row.coat_measurements) as JacketMeasurements | null)
      : (row.coat_measurements as JacketMeasurements | null) ?? null;
  const sweaterMeasurements =
    typeof row.sweater_measurements === "string"
      ? (JSON.parse(row.sweater_measurements) as JacketMeasurements | null)
      : (row.sweater_measurements as JacketMeasurements | null) ?? null;
  const suggestedMeasurementRanges =
    typeof row.suggested_measurement_ranges === "string"
      ? (JSON.parse(row.suggested_measurement_ranges) as BuyerProfile["suggestedMeasurementRanges"])
      : (row.suggested_measurement_ranges as BuyerProfile["suggestedMeasurementRanges"]) ?? null;

  return {
    id: String(row.id),
    name: String(row.name),
    username: String(row.username ?? ""),
    businessName: String(row.business_name ?? ""),
    profileDescription: String(row.profile_description ?? ""),
    showPersonalNameOnProfile: Boolean(row.show_personal_name_on_profile),
    showBusinessNameOnProfile: Boolean(row.show_business_name_on_profile),
    publicLocationMode: (String(row.public_location_mode ?? "country") as PublicLocationMode),
    email: String(row.email),
    emailVerified: Boolean(row.email_verified),
    phoneNumber: String(row.phone_number ?? ""),
    passwordHash: String(row.password_hash),
    role: row.role as Role,
    sellerZipCode: String(row.seller_zip_code ?? ""),
    sellerLocation: String(row.seller_location ?? ""),
    marketplaceIntroDismissed: Boolean(row.marketplace_intro_dismissed),
    stripeAccountId: row.stripe_account_id ? String(row.stripe_account_id) : null,
    stripeOnboardingComplete: Boolean(row.stripe_onboarding_complete),
    createdAt: new Date(String(row.created_at)).toISOString(),
    buyerProfile: {
      zipCode: String(row.zip_code ?? ""),
      location: String(row.location ?? ""),
      address: normalizedAddresses[0] ?? address,
      addresses: normalizedAddresses,
      height: Number(row.height ?? defaultBuyerProfile.height),
      weight: Number(row.weight ?? defaultBuyerProfile.weight),
      chest: Number(row.chest ?? defaultBuyerProfile.chest),
      shoulder: Number(row.shoulder ?? defaultBuyerProfile.shoulder),
      waist: Number(row.waist ?? defaultBuyerProfile.waist),
      sleeve: Number(row.sleeve ?? defaultBuyerProfile.sleeve),
      neck: Number(row.neck ?? defaultBuyerProfile.neck),
      inseam: Number(row.inseam ?? defaultBuyerProfile.inseam),
      fitPreference: (String(row.fit_preference ?? defaultBuyerProfile.fitPreference) === "layering"
        ? "relaxed"
        : String(row.fit_preference ?? defaultBuyerProfile.fitPreference)) as BuyerProfile["fitPreference"],
      maxAlterationBudget: Number(
        row.max_alteration_budget ?? defaultBuyerProfile.maxAlterationBudget
      ),
      searchRadius: Number(row.search_radius ?? defaultBuyerProfile.searchRadius),
      jacketMeasurements,
      shirtMeasurements,
      waistcoatMeasurements,
      trouserMeasurements,
      coatMeasurements,
      sweaterMeasurements,
      suggestedMeasurementRanges
    }
  };
}

function mapListing(row: Record<string, unknown>): Listing {
  const mediaValue = row.media;
  const media =
    typeof mediaValue === "string"
      ? (JSON.parse(mediaValue) as ListingMedia[])
      : (mediaValue as ListingMedia[] | null) ?? [];
  const jacketMeasurements =
    typeof row.jacket_measurements === "string"
      ? (JSON.parse(row.jacket_measurements) as JacketMeasurements | null)
      : (row.jacket_measurements as JacketMeasurements | null) ?? null;
  const rawJacketSpecs =
    typeof row.jacket_specs === "string"
      ? (JSON.parse(row.jacket_specs) as JacketSpecs | null)
      : (row.jacket_specs as JacketSpecs | null) ?? null;
  const waistcoatMeasurements =
    typeof row.waistcoat_measurements === "string"
      ? (JSON.parse(row.waistcoat_measurements) as WaistcoatMeasurements | null)
      : (row.waistcoat_measurements as WaistcoatMeasurements | null) ?? null;
  const waistcoatSpecs =
    typeof row.waistcoat_specs === "string"
      ? (JSON.parse(row.waistcoat_specs) as WaistcoatSpecs | null)
      : (row.waistcoat_specs as WaistcoatSpecs | null) ?? null;
  const trouserMeasurements =
    typeof row.trouser_measurements === "string"
      ? (JSON.parse(row.trouser_measurements) as TrouserMeasurements | null)
      : (row.trouser_measurements as TrouserMeasurements | null) ?? null;
  const trouserSpecs =
    typeof row.trouser_specs === "string"
      ? (JSON.parse(row.trouser_specs) as TrouserSpecs | null)
      : (row.trouser_specs as TrouserSpecs | null) ?? null;
  const shirtSpecs =
    row.category === "shirt" && rawJacketSpecs
      ? {
          collarStyle: ((rawJacketSpecs as unknown) as ShirtSpecs & { collarStyle?: ShirtSpecs["collarStyle"] }).collarStyle ?? "spread",
          cuffStyle: ((rawJacketSpecs as unknown) as ShirtSpecs & { cuffStyle?: ShirtSpecs["cuffStyle"] }).cuffStyle ?? "barrel",
          placket: ((rawJacketSpecs as unknown) as ShirtSpecs & { placket?: ShirtSpecs["placket"] }).placket ?? "standard"
        }
      : null;
  const sweaterSpecs =
    row.category === "sweater" && rawJacketSpecs
      ? {
          neckline: ((rawJacketSpecs as unknown) as SweaterSpecs & { neckline?: SweaterSpecs["neckline"] }).neckline ?? "crew_neck",
          closure: ((rawJacketSpecs as unknown) as SweaterSpecs & { closure?: SweaterSpecs["closure"] }).closure ?? "none"
        }
      : null;
  const jacketSpecs =
    row.category !== "shirt" && row.category !== "sweater" && rawJacketSpecs
      ? {
          ...rawJacketSpecs,
          buttonStyle:
            (rawJacketSpecs as JacketSpecs & { frontButtonStyle?: JacketSpecs["buttonStyle"] }).buttonStyle ??
            (rawJacketSpecs as JacketSpecs & { frontButtonStyle?: JacketSpecs["buttonStyle"] }).frontButtonStyle ??
            "2_buttons",
          ventStyle: rawJacketSpecs.ventStyle ?? "single_vented"
        }
      : null;

  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    sellerDisplayName: String(row.seller_display_name),
    title: String(row.title),
    brand: String(row.brand),
    category: row.category as Listing["category"],
    sizeLabel:
      row.category === "trousers" && row.trouser_size_label
        ? normalizeStoredSizeLabel(String(row.trouser_size_label))
        : normalizeStoredSizeLabel(String(row.size_label)),
    trouserSizeLabel: normalizeStoredSizeLabel(String(row.trouser_size_label ?? "")),
    chest: Number(row.chest),
    shoulder: Number(row.shoulder),
    waist: Number(row.waist),
    sleeve: Number(row.sleeve),
    inseam: Number(row.inseam),
    outseam: Number(row.outseam),
    material: row.material as Listing["material"],
    pattern: row.pattern as Listing["pattern"],
    primaryColor: (row.primary_color as Listing["primaryColor"]) || "navy",
    countryOfOrigin: (row.country_origin as Listing["countryOfOrigin"]) || "unknown",
    lapel: row.lapel as Listing["lapel"],
    fabricWeight: (row.fabric_weight as Listing["fabricWeight"]) || "medium",
    fabricType: ((row.fabric_type === "na" ? "other" : row.fabric_type) as Listing["fabricType"]) || "other",
    fabricWeave: (row.fabric_weave as Listing["fabricWeave"]) || "na",
    condition: row.condition as Listing["condition"],
    vintage: normalizeVintageEra(row.vintage),
    returnsAccepted: Boolean(row.returns_accepted),
    allowOffers: Boolean(row.allow_offers),
    price: Number(row.price),
    shippingPrice: Number(row.shipping_price ?? 0),
    shippingIncluded: false,
    shippingMethod: "ship",
    processingDays: Number(row.processing_days ?? 3),
    location: String(row.location),
    distanceMiles: Number(row.distance_miles),
    description: String(row.description),
    media,
    jacketMeasurements,
    jacketSpecs,
    shirtSpecs,
    sweaterSpecs,
    waistcoatMeasurements,
    waistcoatSpecs,
    trouserMeasurements,
    trouserSpecs,
    status: row.status as ListingStatus,
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: String(row.id),
    buyerId: String(row.buyer_id),
    buyerName: String(row.buyer_name),
    sellerId: String(row.seller_id),
    sellerName: String(row.seller_name),
    listingId: String(row.listing_id),
    listingTitle: String(row.listing_title),
    amount: Number(row.amount),
    subtotal: Number(row.subtotal ?? row.amount),
    shippingAmount: Number(row.shipping_amount ?? 0),
    paymentMethod: row.payment_method as Order["paymentMethod"],
    status: row.status as OrderStatus,
    listingStatus: row.listing_status ? (String(row.listing_status) as ListingStatus) : null,
    returnsAccepted: Boolean(row.returns_accepted),
    stripeCheckoutSessionId: row.stripe_checkout_session_id
      ? String(row.stripe_checkout_session_id)
      : null,
    stripePaymentIntentId: row.stripe_payment_intent_id
      ? String(row.stripe_payment_intent_id)
      : null,
    shippingAddress: {
      fullName: String(row.shipping_full_name ?? ""),
      line1: String(row.shipping_line1 ?? ""),
      line2: String(row.shipping_line2 ?? ""),
      city: String(row.shipping_city ?? ""),
      state: String(row.shipping_state ?? ""),
      postalCode: String(row.shipping_postal_code ?? ""),
      country: String(row.shipping_country ?? "US")
    },
    shippingMethod: "ship",
    carrier: row.carrier ? String(row.carrier) : null,
    trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    trackingUrl: row.tracking_url ? String(row.tracking_url) : null,
    trackingStatus: row.tracking_status ? String(row.tracking_status) : null,
    shippingEta: row.shipping_eta ? new Date(String(row.shipping_eta)).toISOString() : null,
    shippingLabelUrl: row.shipping_label_url ? String(row.shipping_label_url) : null,
    shippingProvider: row.shipping_provider ? String(row.shipping_provider) : null,
    shippingProviderShipmentId: row.shipping_provider_shipment_id ? String(row.shipping_provider_shipment_id) : null,
    shippingProviderRateId: row.shipping_provider_rate_id ? String(row.shipping_provider_rate_id) : null,
    shippingProviderTransactionId: row.shipping_provider_transaction_id
      ? String(row.shipping_provider_transaction_id)
      : null,
    issueReason: row.issue_reason ? String(row.issue_reason) : null,
    sellerNotes: row.seller_notes ? String(row.seller_notes) : null,
    shippedAt: row.shipped_at ? new Date(String(row.shipped_at)).toISOString() : null,
    deliveredAt: row.delivered_at ? new Date(String(row.delivered_at)).toISOString() : null,
    reviewOverallRating: row.review_overall_rating === null || row.review_overall_rating === undefined ? null : Number(row.review_overall_rating),
    reviewMeasurementRating:
      row.review_measurement_rating === null || row.review_measurement_rating === undefined
        ? null
        : Number(row.review_measurement_rating),
    reviewConditionRating:
      row.review_condition_rating === null || row.review_condition_rating === undefined
        ? null
        : Number(row.review_condition_rating),
    reviewShippingRating: row.review_shipping_rating === null || row.review_shipping_rating === undefined ? null : Number(row.review_shipping_rating),
    reviewCommunicationRating:
      row.review_communication_rating === null || row.review_communication_rating === undefined
        ? null
        : Number(row.review_communication_rating),
    reviewFeedback: String(row.review_feedback ?? ""),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

function mapOrderReview(row: Record<string, unknown>): OrderReview {
  return {
    orderId: String(row.order_id),
    buyerId: String(row.buyer_id),
    sellerId: String(row.seller_id),
    overallRating: row.overall_rating === null || row.overall_rating === undefined ? null : Number(row.overall_rating),
    measurementRating:
      row.measurement_rating === null || row.measurement_rating === undefined
        ? null
        : Number(row.measurement_rating),
    conditionRating:
      row.condition_rating === null || row.condition_rating === undefined
        ? null
        : Number(row.condition_rating),
    shippingRating: row.shipping_rating === null || row.shipping_rating === undefined ? null : Number(row.shipping_rating),
    communicationRating:
      row.communication_rating === null || row.communication_rating === undefined ? null : Number(row.communication_rating),
    feedback: String(row.feedback ?? ""),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function mapOffer(row: Record<string, unknown>): Offer {
  return {
    id: String(row.id),
    buyerId: String(row.buyer_id),
    buyerUsername: String(row.buyer_username ?? ""),
    sellerId: String(row.seller_id),
    sellerUsername: String(row.seller_username ?? ""),
    listingId: String(row.listing_id),
    listingTitle: String(row.listing_title ?? ""),
    listingPrice: Number(row.listing_price ?? 0),
    amount: Number(row.amount),
    status: (String(row.status) as OfferStatus) || "active",
    message: row.message ? String(row.message) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.created_at)).toISOString()
  };
}

function mapMessageThread(row: Record<string, unknown>, currentUserId?: string): MessageThread {
  const buyerId = String(row.buyer_id);
  const sellerId = String(row.seller_id);
  const buyerUsername = String(row.buyer_username ?? "");
  const sellerUsername = String(row.seller_username ?? "");
  const fallbackPreview = String(row.subject ?? "");
  const rawPreview = row.last_message_preview ? String(row.last_message_preview) : fallbackPreview;
  const normalizedPreview = rawPreview.length > 120 ? `${rawPreview.slice(0, 117)}...` : rawPreview;
  const lastMessageSenderId = row.last_message_sender_id ? String(row.last_message_sender_id) : "";
  const unread =
    currentUserId
      ? buyerId === currentUserId
        ? lastMessageSenderId !== "" &&
          lastMessageSenderId !== currentUserId &&
          (!row.buyer_last_read_at || new Date(String(row.last_message_at ?? row.created_at)) > new Date(String(row.buyer_last_read_at)))
        : sellerId === currentUserId
          ? lastMessageSenderId !== "" &&
            lastMessageSenderId !== currentUserId &&
            (!row.seller_last_read_at || new Date(String(row.last_message_at ?? row.created_at)) > new Date(String(row.seller_last_read_at)))
          : false
      : false;

  return {
    id: String(row.id),
    buyerId,
    buyerUsername,
    sellerId,
    sellerUsername,
    listingId: row.listing_id ? String(row.listing_id) : null,
    listingTitle: row.listing_title ? String(row.listing_title) : null,
    orderId: row.order_id ? String(row.order_id) : null,
    subject:
      String(row.subject || "") ||
      (currentUserId === sellerId ? buyerUsername : sellerUsername) ||
      "Conversation",
    lastMessagePreview: normalizedPreview,
    unread,
    lastMessageAt: new Date(String(row.last_message_at ?? row.created_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    senderId: String(row.sender_id),
    senderUsername: String(row.sender_username ?? ""),
    body: String(row.body),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

function mapSavedSearch(row: Record<string, unknown>): SavedSearch {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    queryString: String(row.query_string),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

export async function ensureSeedData(): Promise<void> {
  if (!databaseConfigured) {
    return;
  }

  await ensureSchema();
  const client = requirePool();
  const countResult = await queryWithRetry<{ count: string }>("SELECT COUNT(*)::text AS count FROM users");
  const userCount = Number(countResult.rows[0]?.count ?? "0");

  if (userCount > 0) {
    return;
  }

  const sellers = [
    { id: randomUUID(), name: "Atelier Hudson", email: "seller1@tailorgraph.local" },
    { id: randomUUID(), name: "Canal Street Tailoring", email: "seller2@tailorgraph.local" },
    { id: randomUUID(), name: "Commonwealth Menswear", email: "seller3@tailorgraph.local" }
  ];
  const sellerProfiles = [
    { zipCode: "10001", location: "New York, NY" },
    { zipCode: "11201", location: "Brooklyn, NY" },
    { zipCode: "07302", location: "Jersey City, NJ" }
  ];

  for (const [index, seller] of sellers.entries()) {
    await client.query(
      `INSERT INTO users (id, name, username, email, password_hash, role, seller_zip_code, seller_location, stripe_account_id, stripe_onboarding_complete, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        seller.id,
        seller.name,
        normalizeUsernameCandidate(seller.name),
        seller.email,
        "seed",
        "both",
        sellerProfiles[index].zipCode,
        sellerProfiles[index].location,
        null,
        false
      ]
    );

    await client.query(
      `INSERT INTO buyer_profiles (
        user_id, zip_code, location, address, addresses, height, chest, shoulder, waist, sleeve, inseam, max_alteration_budget, search_radius,
        jacket_measurements, waistcoat_measurements, trouser_measurements, coat_measurements
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        seller.id,
        "",
        "",
        JSON.stringify(emptyShippingAddress),
        JSON.stringify([]),
        defaultBuyerProfile.height,
        defaultBuyerProfile.chest,
        defaultBuyerProfile.shoulder,
        defaultBuyerProfile.waist,
        defaultBuyerProfile.sleeve,
        defaultBuyerProfile.inseam,
        defaultBuyerProfile.maxAlterationBudget,
        defaultBuyerProfile.searchRadius,
        null,
        null,
        null,
        null
      ]
    );
  }

  const seedListings = [
    {
      seller: sellers[0],
      title: "Ring Jacket Charcoal Suit",
      brand: "Ring Jacket",
      category: "two_piece_suit",
      sizeLabel: "40R",
      trouserSizeLabel: "34",
      chest: 40.5,
      shoulder: 17.9,
      waist: 34,
      sleeve: 34.2,
      inseam: 31,
      outseam: 41.4,
      material: "wool",
      pattern: "birdseye",
      primaryColor: "gray_charcoal",
      countryOfOrigin: "italy",
      lapel: "peak",
      fabricWeight: "medium",
      fabricType: "na",
      fabricWeave: "na",
      condition: "used_excellent",
      vintage: "modern",
      returnsAccepted: false,
      allowOffers: true,
      price: 940,
      shippingPrice: 0,
      shippingIncluded: false,
      shippingMethod: "ship",
      processingDays: 3,
      location: "New York, NY",
      distanceMiles: 6,
      description: "Soft shoulder, strong drape, full-canvas build and clean tailoring history.",
      media: [],
        jacketMeasurements: {
        chest: 40.5,
        waist: 34,
        shoulders: 17.9,
        bodyLength: 29.5,
        sleeveLength: 34.2,
        sleeveLengthAllowance: 0.75
        },
        jacketSpecs: {
        cut: "single_breasted",
        lapel: "peak",
        buttonStyle: "2_buttons",
        ventStyle: "double_vented",
        canvas: "full",
        lining: "full",
        formal: "na"
        },
        shirtSpecs: null,
        sweaterSpecs: null,
        waistcoatMeasurements: null,
      waistcoatSpecs: null,
      trouserMeasurements: {
        waist: 34,
        waistAllowance: 1.5,
        hips: 40,
        inseam: 31,
        inseamOutseamAllowance: 1.25,
        outseam: 41.4,
        opening: 8
      },
      trouserSpecs: {
        cut: "straight",
        front: "flat",
        formal: "na"
      },
      status: "active"
    },
    {
      seller: sellers[1],
      title: "Drake's Tobacco Linen Jacket",
      brand: "Drake's",
      category: "jacket",
      sizeLabel: "42R",
      trouserSizeLabel: "",
      chest: 42,
      shoulder: 18.6,
      waist: 36,
      sleeve: 34.5,
      inseam: 0,
      outseam: 0,
      material: "linen",
      pattern: "herringbone",
      primaryColor: "brown",
      countryOfOrigin: "united_kingdom",
      lapel: "notch",
      fabricWeight: "light",
      fabricType: "na",
      fabricWeave: "na",
      condition: "used_very_good",
      vintage: "modern",
      returnsAccepted: false,
      allowOffers: true,
      price: 590,
      shippingPrice: 18,
      shippingIncluded: false,
      shippingMethod: "ship",
      processingDays: 2,
      location: "Brooklyn, NY",
      distanceMiles: 18,
      description: "Sport coat with patch pockets and easy summer drape.",
      media: [],
        jacketMeasurements: {
        chest: 42,
        waist: 36,
        shoulders: 18.6,
        bodyLength: 30,
        sleeveLength: 34.5,
        sleeveLengthAllowance: 0.5
        },
        jacketSpecs: {
        cut: "single_breasted",
        lapel: "notch",
        buttonStyle: "2_buttons",
        ventStyle: "single_vented",
        canvas: "half",
        lining: "half",
        formal: "na"
        },
        shirtSpecs: null,
        sweaterSpecs: null,
        waistcoatMeasurements: null,
      waistcoatSpecs: null,
      trouserMeasurements: null,
      trouserSpecs: null,
      status: "active"
    },
    {
      seller: sellers[2],
      title: "Sid Mashburn Prince of Wales Suit",
      brand: "Sid Mashburn",
      category: "two_piece_suit",
      sizeLabel: "39R",
      trouserSizeLabel: "32",
      chest: 39,
      shoulder: 17.4,
      waist: 32.5,
      sleeve: 33.4,
      inseam: 30.5,
      outseam: 40.5,
      material: "wool",
      pattern: "check",
      primaryColor: "gray_charcoal",
      countryOfOrigin: "italy",
      lapel: "notch",
      fabricWeight: "medium",
      fabricType: "na",
      fabricWeave: "na",
      condition: "used_good",
      vintage: "modern",
      returnsAccepted: false,
      allowOffers: true,
      price: 420,
      shippingPrice: 20,
      shippingIncluded: false,
      shippingMethod: "ship",
      processingDays: 1,
      location: "Jersey City, NJ",
      distanceMiles: 34,
      description: "Light structure with a classic British pattern and room at the hem.",
      media: [],
        jacketMeasurements: {
        chest: 39,
        waist: 32.5,
        shoulders: 17.4,
        bodyLength: 29,
        sleeveLength: 33.4,
        sleeveLengthAllowance: 0.75
        },
        jacketSpecs: {
        cut: "single_breasted",
        lapel: "notch",
        buttonStyle: "2_buttons",
        ventStyle: "single_vented",
        canvas: "half",
        lining: "half",
        formal: "na"
        },
        shirtSpecs: null,
        sweaterSpecs: null,
        waistcoatMeasurements: null,
      waistcoatSpecs: null,
      trouserMeasurements: {
        waist: 32.5,
        waistAllowance: 1.5,
        hips: 38,
        inseam: 30.5,
        inseamOutseamAllowance: 1,
        outseam: 40.5,
        opening: 7.75
      },
      trouserSpecs: {
        cut: "tapered",
        front: "flat",
        formal: "na"
      },
      status: "active"
    }
  ];

  for (const listing of seedListings) {
    await client.query(
      `INSERT INTO listings (
        id, seller_id, seller_display_name, title, brand, category, size_label, trouser_size_label, chest, shoulder, waist, sleeve, inseam,
        outseam, material, pattern, primary_color, country_origin, lapel, fabric_weight, fabric_type, fabric_weave, condition, vintage, returns_accepted, allow_offers,
        price, shipping_price, shipping_included, shipping_method, processing_days,
        location, distance_miles, description, media, jacket_measurements, jacket_specs,
        waistcoat_measurements, waistcoat_specs, trouser_measurements, trouser_specs, status, created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,NOW()
      )`,
      [
        randomUUID(),
        listing.seller.id,
        listing.seller.name,
        listing.title,
        listing.brand,
        listing.category,
        normalizeStoredSizeLabel(listing.sizeLabel),
        normalizeStoredSizeLabel(listing.trouserSizeLabel),
        listing.chest,
        listing.shoulder,
        listing.waist,
        listing.sleeve,
        listing.inseam,
        listing.outseam,
        listing.material,
        listing.pattern,
        listing.primaryColor,
        listing.countryOfOrigin,
        listing.lapel,
        listing.fabricWeight,
        listing.fabricType,
        listing.fabricWeave,
        listing.condition,
        listing.vintage,
        listing.returnsAccepted,
        listing.allowOffers,
        listing.price,
        listing.shippingPrice,
        listing.shippingIncluded,
        listing.shippingMethod,
        listing.processingDays,
        listing.location,
        listing.distanceMiles,
        listing.description,
        JSON.stringify(listing.media),
        listing.jacketMeasurements ? JSON.stringify(listing.jacketMeasurements) : null,
        listing.jacketSpecs ? JSON.stringify(listing.jacketSpecs) : null,
        listing.waistcoatMeasurements ? JSON.stringify(listing.waistcoatMeasurements) : null,
        listing.waistcoatSpecs ? JSON.stringify(listing.waistcoatSpecs) : null,
        listing.trouserMeasurements ? JSON.stringify(listing.trouserMeasurements) : null,
        listing.trouserSpecs ? JSON.stringify(listing.trouserSpecs) : null,
        listing.status
      ]
    );
  }
}

export async function findUserById(userId: string): Promise<User | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT users.*, buyer_profiles.height, buyer_profiles.weight, buyer_profiles.chest, buyer_profiles.shoulder, buyer_profiles.waist,
            buyer_profiles.sleeve, buyer_profiles.neck, buyer_profiles.inseam, buyer_profiles.fit_preference,
            buyer_profiles.max_alteration_budget, buyer_profiles.search_radius,
            buyer_profiles.jacket_measurements, buyer_profiles.shirt_measurements, buyer_profiles.waistcoat_measurements,
            buyer_profiles.trouser_measurements, buyer_profiles.coat_measurements, buyer_profiles.sweater_measurements,
            buyer_profiles.suggested_measurement_ranges,
            buyer_profiles.zip_code, buyer_profiles.location, buyer_profiles.address, buyer_profiles.addresses
     FROM users
     LEFT JOIN buyer_profiles ON buyer_profiles.user_id = users.id
     WHERE users.id = $1`,
    [userId]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT users.*, buyer_profiles.height, buyer_profiles.weight, buyer_profiles.chest, buyer_profiles.shoulder, buyer_profiles.waist,
            buyer_profiles.sleeve, buyer_profiles.neck, buyer_profiles.inseam, buyer_profiles.fit_preference,
            buyer_profiles.max_alteration_budget, buyer_profiles.search_radius,
            buyer_profiles.jacket_measurements, buyer_profiles.shirt_measurements, buyer_profiles.waistcoat_measurements,
            buyer_profiles.trouser_measurements, buyer_profiles.coat_measurements, buyer_profiles.sweater_measurements,
            buyer_profiles.suggested_measurement_ranges,
            buyer_profiles.zip_code, buyer_profiles.location, buyer_profiles.address, buyer_profiles.addresses
     FROM users
     LEFT JOIN buyer_profiles ON buyer_profiles.user_id = users.id
     WHERE users.email = $1`,
    [email.toLowerCase()]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT users.*, buyer_profiles.height, buyer_profiles.weight, buyer_profiles.chest, buyer_profiles.shoulder, buyer_profiles.waist,
            buyer_profiles.sleeve, buyer_profiles.neck, buyer_profiles.inseam, buyer_profiles.fit_preference,
            buyer_profiles.max_alteration_budget, buyer_profiles.search_radius,
            buyer_profiles.jacket_measurements, buyer_profiles.shirt_measurements, buyer_profiles.waistcoat_measurements,
            buyer_profiles.trouser_measurements, buyer_profiles.coat_measurements, buyer_profiles.sweater_measurements,
            buyer_profiles.suggested_measurement_ranges,
            buyer_profiles.zip_code, buyer_profiles.location, buyer_profiles.address, buyer_profiles.addresses
     FROM users
     LEFT JOIN buyer_profiles ON buyer_profiles.user_id = users.id
     WHERE users.username = $1`,
    [normalizeUsernameCandidate(username)]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function createUser(input: {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
}): Promise<User> {
  await ensureSchema();
  const client = requirePool();
  const id = randomUUID();
  const username = await generateAvailableUsername(input.username || input.name);
  const userResult = await client.query(
    `INSERT INTO users (id, name, username, email, phone_number, password_hash, role, seller_zip_code, seller_location, stripe_account_id, stripe_onboarding_complete, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
     RETURNING *`,
    [id, input.name, username, input.email.toLowerCase(), "", input.passwordHash, input.role, "", "", null, false]
  );

  await client.query(
   `INSERT INTO buyer_profiles (
      user_id, zip_code, location, address, addresses, height, chest, shoulder, waist, sleeve, inseam, max_alteration_budget, search_radius,
      jacket_measurements, waistcoat_measurements, trouser_measurements, coat_measurements
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)` ,
    [
      id,
      "",
      "",
      JSON.stringify(emptyShippingAddress),
      JSON.stringify([]),
      defaultBuyerProfile.height,
      defaultBuyerProfile.chest,
      defaultBuyerProfile.shoulder,
      defaultBuyerProfile.waist,
      defaultBuyerProfile.sleeve,
      defaultBuyerProfile.inseam,
      defaultBuyerProfile.maxAlterationBudget,
      defaultBuyerProfile.searchRadius,
      null,
      null,
      null,
      null
    ]
  );

  return {
    id,
    name: String(userResult.rows[0].name),
    username: String(userResult.rows[0].username),
    businessName: "",
    showPersonalNameOnProfile: false,
    showBusinessNameOnProfile: false,
    publicLocationMode: "country",
    email: String(userResult.rows[0].email),
    emailVerified: false,
    phoneNumber: "",
    passwordHash: String(userResult.rows[0].password_hash),
    role: input.role,
    sellerZipCode: "",
    sellerLocation: "",
    marketplaceIntroDismissed: false,
    stripeAccountId: null,
    stripeOnboardingComplete: false,
    buyerProfile: defaultBuyerProfile,
    createdAt: new Date(String(userResult.rows[0].created_at)).toISOString()
  } satisfies User;
}

export async function updateUser(userId: string, profile: BuyerProfile): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    `INSERT INTO buyer_profiles (
      user_id, zip_code, location, address, addresses, height, weight, chest, shoulder, waist, sleeve, neck, inseam, fit_preference,
      max_alteration_budget, search_radius, jacket_measurements, shirt_measurements, waistcoat_measurements, trouser_measurements,
      coat_measurements, sweater_measurements, suggested_measurement_ranges
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
    ON CONFLICT (user_id) DO UPDATE SET
      zip_code = EXCLUDED.zip_code,
      location = EXCLUDED.location,
      address = EXCLUDED.address,
      addresses = EXCLUDED.addresses,
      height = EXCLUDED.height,
      weight = EXCLUDED.weight,
      chest = EXCLUDED.chest,
      shoulder = EXCLUDED.shoulder,
      waist = EXCLUDED.waist,
      sleeve = EXCLUDED.sleeve,
      neck = EXCLUDED.neck,
      inseam = EXCLUDED.inseam,
      fit_preference = EXCLUDED.fit_preference,
      max_alteration_budget = EXCLUDED.max_alteration_budget,
      search_radius = EXCLUDED.search_radius,
      jacket_measurements = EXCLUDED.jacket_measurements,
      shirt_measurements = EXCLUDED.shirt_measurements,
      waistcoat_measurements = EXCLUDED.waistcoat_measurements,
      trouser_measurements = EXCLUDED.trouser_measurements,
      coat_measurements = EXCLUDED.coat_measurements,
      sweater_measurements = EXCLUDED.sweater_measurements,
      suggested_measurement_ranges = EXCLUDED.suggested_measurement_ranges`,
    [
      userId,
      profile.zipCode,
      profile.location,
      JSON.stringify(profile.address),
      JSON.stringify(profile.addresses),
      profile.height,
      profile.weight,
      profile.chest,
      profile.shoulder,
      profile.waist,
      profile.sleeve,
      profile.neck,
      profile.inseam,
      profile.fitPreference,
      profile.maxAlterationBudget,
      profile.searchRadius,
      profile.jacketMeasurements ? JSON.stringify(profile.jacketMeasurements) : null,
      profile.shirtMeasurements ? JSON.stringify(profile.shirtMeasurements) : null,
      profile.waistcoatMeasurements ? JSON.stringify(profile.waistcoatMeasurements) : null,
      profile.trouserMeasurements ? JSON.stringify(profile.trouserMeasurements) : null,
      profile.coatMeasurements ? JSON.stringify(profile.coatMeasurements) : null,
      profile.sweaterMeasurements ? JSON.stringify(profile.sweaterMeasurements) : null,
      profile.suggestedMeasurementRanges ? JSON.stringify(profile.suggestedMeasurementRanges) : null
    ]
  );
}

export async function updateBuyerAccount(
  userId: string,
  input: {
    name: string;
    email: string;
    phoneNumber: string;
    zipCode: string;
    location: string;
    address: ShippingAddress;
    addresses: ShippingAddress[];
    businessName: string;
    profileDescription: string;
    showPersonalNameOnProfile: boolean;
    showBusinessNameOnProfile: boolean;
    publicLocationMode: PublicLocationMode;
  }
): Promise<void> {
  await ensureSchema();
  const client = requirePool();
  await client.query(
    `UPDATE users
     SET name = $1,
         email = $2,
        phone_number = $3,
        business_name = $4,
        profile_description = $5,
        show_personal_name_on_profile = $6,
        show_business_name_on_profile = $7,
        public_location_mode = $8
    WHERE id = $9`,
    [
      input.name,
      input.email.toLowerCase(),
      input.phoneNumber,
      input.businessName,
      input.profileDescription,
      input.showPersonalNameOnProfile,
      input.showBusinessNameOnProfile,
      input.publicLocationMode,
      userId
    ]
  );

  await client.query(
    `INSERT INTO buyer_profiles (
      user_id, zip_code, location, address, addresses, height, weight, chest, shoulder, waist, sleeve, neck, inseam, fit_preference,
      max_alteration_budget, search_radius, jacket_measurements, shirt_measurements, waistcoat_measurements, trouser_measurements,
      coat_measurements, sweater_measurements, suggested_measurement_ranges
    )
    SELECT
      $1, $2, $3, $4, $5,
      COALESCE(height, $6), COALESCE(weight, $7), COALESCE(chest, $8), COALESCE(shoulder, $9), COALESCE(waist, $10), COALESCE(sleeve, $11),
      COALESCE(neck, $12), COALESCE(inseam, $13), COALESCE(fit_preference, $14),
      COALESCE(max_alteration_budget, $15), COALESCE(search_radius, $16),
      jacket_measurements, shirt_measurements, waistcoat_measurements, trouser_measurements, coat_measurements, sweater_measurements, suggested_measurement_ranges
    FROM buyer_profiles
    WHERE user_id = $1
    ON CONFLICT (user_id) DO UPDATE SET
      zip_code = EXCLUDED.zip_code,
      location = EXCLUDED.location,
      address = EXCLUDED.address,
      addresses = EXCLUDED.addresses`,
    [
      userId,
      input.zipCode,
      input.location,
      JSON.stringify(input.address),
      JSON.stringify(input.addresses),
      defaultBuyerProfile.height,
      defaultBuyerProfile.weight,
      defaultBuyerProfile.chest,
      defaultBuyerProfile.shoulder,
      defaultBuyerProfile.waist,
      defaultBuyerProfile.sleeve,
      defaultBuyerProfile.neck,
      defaultBuyerProfile.inseam,
      defaultBuyerProfile.fitPreference,
      defaultBuyerProfile.maxAlterationBudget,
      defaultBuyerProfile.searchRadius
    ]
  );
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await ensureSchema();
  await requirePool().query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
}

export async function updateUsername(userId: string, username: string): Promise<void> {
  await ensureSchema();
  const normalizedUsername = normalizeUsernameCandidate(username);
  const client = requirePool();
  await client.query("UPDATE users SET username = $1 WHERE id = $2", [normalizedUsername, userId]);
  await client.query("UPDATE listings SET seller_display_name = $1 WHERE seller_id = $2", [normalizedUsername, userId]);
}

export async function updateUserEmail(userId: string, email: string): Promise<void> {
  await ensureSchema();
  await requirePool().query("UPDATE users SET email = $1, email_verified = FALSE WHERE id = $2", [email.toLowerCase(), userId]);
}

export async function createPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  await ensureSchema();
  const client = requirePool();
  await client.query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
    [userId]
  );
  await client.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
     VALUES ($1, $2, $3, $4, NULL, NOW())`,
    [randomUUID(), userId, tokenHash, expiresAt.toISOString()]
  );
}

export async function findValidPasswordResetUserByTokenHash(tokenHash: string): Promise<User | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT users.*, buyer_profiles.height, buyer_profiles.weight, buyer_profiles.chest, buyer_profiles.shoulder, buyer_profiles.waist,
            buyer_profiles.sleeve, buyer_profiles.neck, buyer_profiles.inseam, buyer_profiles.fit_preference,
            buyer_profiles.max_alteration_budget, buyer_profiles.search_radius,
            buyer_profiles.jacket_measurements, buyer_profiles.shirt_measurements, buyer_profiles.waistcoat_measurements,
            buyer_profiles.trouser_measurements, buyer_profiles.coat_measurements, buyer_profiles.sweater_measurements,
            buyer_profiles.suggested_measurement_ranges,
            buyer_profiles.zip_code, buyer_profiles.location, buyer_profiles.address, buyer_profiles.addresses
     FROM password_reset_tokens
     INNER JOIN users ON users.id = password_reset_tokens.user_id
     LEFT JOIN buyer_profiles ON buyer_profiles.user_id = users.id
     WHERE password_reset_tokens.token_hash = $1
       AND password_reset_tokens.used_at IS NULL
       AND password_reset_tokens.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function markPasswordResetTokenUsed(tokenHash: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL",
    [tokenHash]
  );
}

export async function clearPasswordResetTokensForUser(userId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
    [userId]
  );
}

export async function createEmailVerificationToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  await ensureSchema();
  const client = requirePool();
  await client.query(
    "UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
    [userId]
  );
  await client.query(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
     VALUES ($1, $2, $3, $4, NULL, NOW())`,
    [randomUUID(), userId, tokenHash, expiresAt.toISOString()]
  );
}

export async function findValidEmailVerificationUserByTokenHash(tokenHash: string): Promise<User | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT users.*, buyer_profiles.height, buyer_profiles.weight, buyer_profiles.chest, buyer_profiles.shoulder, buyer_profiles.waist,
            buyer_profiles.sleeve, buyer_profiles.neck, buyer_profiles.inseam, buyer_profiles.fit_preference,
            buyer_profiles.max_alteration_budget, buyer_profiles.search_radius,
            buyer_profiles.jacket_measurements, buyer_profiles.shirt_measurements, buyer_profiles.waistcoat_measurements,
            buyer_profiles.trouser_measurements, buyer_profiles.coat_measurements, buyer_profiles.sweater_measurements,
            buyer_profiles.suggested_measurement_ranges,
            buyer_profiles.zip_code, buyer_profiles.location, buyer_profiles.address, buyer_profiles.addresses
     FROM email_verification_tokens
     INNER JOIN users ON users.id = email_verification_tokens.user_id
     LEFT JOIN buyer_profiles ON buyer_profiles.user_id = users.id
     WHERE email_verification_tokens.token_hash = $1
       AND email_verification_tokens.used_at IS NULL
       AND email_verification_tokens.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function markEmailVerificationTokenUsed(tokenHash: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    "UPDATE email_verification_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL",
    [tokenHash]
  );
}

export async function clearEmailVerificationTokensForUser(userId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    "UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
    [userId]
  );
}

export async function markUserEmailVerified(userId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query("UPDATE users SET email_verified = TRUE WHERE id = $1", [userId]);
}

export async function updateSellerLocation(
  userId: string,
  sellerZipCode: string,
  sellerLocation: string
): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    "UPDATE users SET seller_zip_code = $1, seller_location = $2 WHERE id = $3",
    [sellerZipCode, sellerLocation, userId]
  );
}

export async function dismissMarketplaceIntro(userId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    "UPDATE users SET marketplace_intro_dismissed = TRUE WHERE id = $1",
    [userId]
  );
}

export async function updateUserStripeAccount(userId: string, stripeAccountId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query("UPDATE users SET stripe_account_id = $1 WHERE id = $2", [stripeAccountId, userId]);
}

export async function markUserStripeOnboardingComplete(userId: string, completed: boolean): Promise<void> {
  await ensureSchema();
  await requirePool().query("UPDATE users SET stripe_onboarding_complete = $1 WHERE id = $2", [completed, userId]);
}

export async function listMarketplace(): Promise<Listing[]> {
  if (!databaseConfigured) {
    return [] as Listing[];
  }

  await ensureSchema();
  const result = await requirePool().query("SELECT * FROM listings ORDER BY created_at DESC");
  return result.rows.map(mapListing);
}

export async function listSellerInventory(userId: string): Promise<Listing[]> {
  if (!databaseConfigured) {
    return [] as Listing[];
  }

  await ensureSchema();
  const result = await requirePool().query("SELECT * FROM listings WHERE seller_id = $1 ORDER BY created_at DESC", [userId]);
  return result.rows.map(mapListing);
}

export async function listActiveListingsBySellerId(userId: string): Promise<Listing[]> {
  if (!databaseConfigured) {
    return [] as Listing[];
  }

  await ensureSchema();
  const result = await requirePool().query(
    "SELECT * FROM listings WHERE seller_id = $1 AND status = 'active' ORDER BY created_at DESC",
    [userId]
  );
  return result.rows.map(mapListing);
}

export async function listSoldListingsBySellerId(userId: string): Promise<Listing[]> {
  if (!databaseConfigured) {
    return [] as Listing[];
  }

  await ensureSchema();
  const result = await requirePool().query(
    "SELECT * FROM listings WHERE seller_id = $1 AND status = 'sold' ORDER BY created_at DESC",
    [userId]
  );
  return result.rows.map(mapListing);
}

export async function findListingById(listingId: string): Promise<Listing | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query("SELECT * FROM listings WHERE id = $1", [listingId]);
  return result.rows[0] ? mapListing(result.rows[0]) : null;
}

export async function createListing(
  seller: User,
  input: Omit<Listing, "id" | "sellerId" | "sellerDisplayName" | "createdAt">
): Promise<Listing> {
  await ensureSchema();
  const client = requirePool();
  const id = randomUUID();
  const result = await client.query(
    `INSERT INTO listings (
      id, seller_id, seller_display_name, title, brand, category, size_label, trouser_size_label, chest, shoulder, waist, sleeve, inseam,
      outseam, material, pattern, primary_color, country_origin, lapel, fabric_weight, fabric_type, fabric_weave, condition, vintage, returns_accepted, allow_offers,
      price, shipping_price, shipping_included, shipping_method, processing_days,
      location, distance_miles, description, media, jacket_measurements, jacket_specs,
      waistcoat_measurements, waistcoat_specs, trouser_measurements, trouser_specs, status, created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,NOW()
    ) RETURNING *`,
    [
      id,
      seller.id,
      seller.username || normalizeUsernameCandidate(seller.name) || seller.name,
      input.title,
      input.brand,
      input.category,
      normalizeStoredSizeLabel(input.sizeLabel),
      normalizeStoredSizeLabel(input.trouserSizeLabel),
      input.chest,
      input.shoulder,
      input.waist,
      input.sleeve,
      input.inseam,
      input.outseam,
      input.material,
      input.pattern,
      input.primaryColor,
      input.countryOfOrigin,
      input.lapel,
      input.fabricWeight,
      input.fabricType,
      input.fabricWeave,
      input.condition,
      input.vintage,
      input.returnsAccepted,
      input.allowOffers,
      input.price,
      input.shippingPrice,
      input.shippingIncluded,
      input.shippingMethod,
      input.processingDays,
      input.location,
      input.distanceMiles,
      input.description,
      JSON.stringify(input.media),
      input.jacketMeasurements ? JSON.stringify(input.jacketMeasurements) : null,
      input.category === "shirt"
        ? input.shirtSpecs
          ? JSON.stringify(input.shirtSpecs)
          : null
        : input.category === "sweater"
          ? input.sweaterSpecs
            ? JSON.stringify(input.sweaterSpecs)
            : null
        : input.jacketSpecs
          ? JSON.stringify(input.jacketSpecs)
          : null,
      input.waistcoatMeasurements ? JSON.stringify(input.waistcoatMeasurements) : null,
      input.waistcoatSpecs ? JSON.stringify(input.waistcoatSpecs) : null,
      input.trouserMeasurements ? JSON.stringify(input.trouserMeasurements) : null,
      input.trouserSpecs ? JSON.stringify(input.trouserSpecs) : null,
      input.status
    ]
  );
  return mapListing(result.rows[0]);
}

export async function updateListingStatus(listingId: string, status: ListingStatus): Promise<void> {
  await ensureSchema();
  await requirePool().query("UPDATE listings SET status = $1 WHERE id = $2", [status, listingId]);
}

export async function updateListing(
  listingId: string,
  input: Omit<Listing, "id" | "sellerId" | "sellerDisplayName" | "createdAt">
): Promise<Listing> {
  await ensureSchema();
  const result = await requirePool().query(
    `UPDATE listings SET
      title = $2,
      brand = $3,
      category = $4,
      size_label = $5,
      trouser_size_label = $6,
      chest = $7,
      shoulder = $8,
      waist = $9,
      sleeve = $10,
      inseam = $11,
      outseam = $12,
      material = $13,
      pattern = $14,
      primary_color = $15,
      country_origin = $16,
      lapel = $17,
      fabric_weight = $18,
      fabric_type = $19,
      fabric_weave = $20,
      condition = $21,
      vintage = $22,
      returns_accepted = $23,
      allow_offers = $24,
      price = $25,
      shipping_price = $26,
      shipping_included = $27,
      shipping_method = $28,
      processing_days = $29,
      location = $30,
      distance_miles = $31,
      description = $32,
      media = $33,
      jacket_measurements = $34,
      jacket_specs = $35,
      waistcoat_measurements = $36,
      waistcoat_specs = $37,
      trouser_measurements = $38,
      trouser_specs = $39,
      status = $40
     WHERE id = $1
     RETURNING *`,
    [
      listingId,
      input.title,
      input.brand,
      input.category,
      normalizeStoredSizeLabel(input.sizeLabel),
      normalizeStoredSizeLabel(input.trouserSizeLabel),
      input.chest,
      input.shoulder,
      input.waist,
      input.sleeve,
      input.inseam,
      input.outseam,
      input.material,
      input.pattern,
      input.primaryColor,
      input.countryOfOrigin,
      input.lapel,
      input.fabricWeight,
      input.fabricType,
      input.fabricWeave,
      input.condition,
      input.vintage,
      input.returnsAccepted,
      input.allowOffers,
      input.price,
      input.shippingPrice,
      input.shippingIncluded,
      input.shippingMethod,
      input.processingDays,
      input.location,
      input.distanceMiles,
      input.description,
      JSON.stringify(input.media),
      input.jacketMeasurements ? JSON.stringify(input.jacketMeasurements) : null,
      input.category === "shirt"
        ? input.shirtSpecs
          ? JSON.stringify(input.shirtSpecs)
          : null
        : input.category === "sweater"
          ? input.sweaterSpecs
            ? JSON.stringify(input.sweaterSpecs)
            : null
        : input.jacketSpecs
          ? JSON.stringify(input.jacketSpecs)
          : null,
      input.waistcoatMeasurements ? JSON.stringify(input.waistcoatMeasurements) : null,
      input.waistcoatSpecs ? JSON.stringify(input.waistcoatSpecs) : null,
      input.trouserMeasurements ? JSON.stringify(input.trouserMeasurements) : null,
      input.trouserSpecs ? JSON.stringify(input.trouserSpecs) : null,
      input.status
    ]
  );

  return mapListing(result.rows[0]);
}

export async function createOrder(
  input: Omit<
    Order,
    | "id"
    | "createdAt"
    | "reviewOverallRating"
    | "reviewMeasurementRating"
    | "reviewConditionRating"
    | "reviewShippingRating"
    | "reviewCommunicationRating"
    | "reviewFeedback"
    | "trackingUrl"
    | "trackingStatus"
    | "shippingEta"
    | "shippingLabelUrl"
    | "shippingProvider"
    | "shippingProviderShipmentId"
    | "shippingProviderRateId"
    | "shippingProviderTransactionId"
  >
): Promise<Order> {
  await ensureSchema();
  const client = requirePool();
  const id = randomUUID();
  const result = await client.query(
    `INSERT INTO orders (
      id, buyer_id, buyer_name, seller_id, seller_name, listing_id, listing_title, amount, subtotal, shipping_amount,
      payment_method, status, stripe_checkout_session_id, stripe_payment_intent_id,
      shipping_full_name, shipping_line1, shipping_line2, shipping_city, shipping_state, shipping_postal_code, shipping_country,
      shipping_method, carrier, tracking_number, tracking_url, tracking_status, shipping_eta, shipping_label_url,
      shipping_provider, shipping_provider_shipment_id, shipping_provider_rate_id, shipping_provider_transaction_id,
      issue_reason, seller_notes, shipped_at, delivered_at, created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,NOW()
    ) RETURNING *`,
    [
      id,
      input.buyerId,
      input.buyerName,
      input.sellerId,
      input.sellerName,
      input.listingId,
      input.listingTitle,
      input.amount,
      input.subtotal,
      input.shippingAmount,
      input.paymentMethod,
      input.status,
      input.stripeCheckoutSessionId,
      input.stripePaymentIntentId,
      input.shippingAddress.fullName,
      input.shippingAddress.line1,
      input.shippingAddress.line2,
      input.shippingAddress.city,
      input.shippingAddress.state,
      input.shippingAddress.postalCode,
      input.shippingAddress.country,
      input.shippingMethod,
      input.carrier,
      input.trackingNumber,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      input.issueReason,
      input.sellerNotes,
      input.shippedAt,
      input.deliveredAt
    ]
  );
  return mapOrder(result.rows[0]);
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await ensureSchema();
  await requirePool().query("UPDATE orders SET status = $1 WHERE id = $2", [status, orderId]);
}

export async function updateOrderShipping(
  orderId: string,
  carrier: string,
  trackingNumber: string,
  sellerNotes: string | null
): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    `UPDATE orders
     SET status = 'shipped',
         carrier = $1,
         tracking_number = $2,
         seller_notes = $3,
         tracking_url = NULL,
         tracking_status = NULL,
         shipping_eta = NULL,
         shipping_label_url = NULL,
         shipping_provider = NULL,
         shipping_provider_shipment_id = NULL,
         shipping_provider_rate_id = NULL,
         shipping_provider_transaction_id = NULL,
         shipped_at = NOW()
     WHERE id = $4`,
    [carrier, trackingNumber, sellerNotes, orderId]
  );
}

export async function updateOrderShippingWithProvider(
  orderId: string,
  input: {
    carrier: string;
    trackingNumber: string;
    trackingUrl: string | null;
    trackingStatus: string | null;
    shippingEta: string | null;
    shippingLabelUrl: string | null;
    shippingProvider: string;
    shippingProviderShipmentId: string | null;
    shippingProviderRateId: string | null;
    shippingProviderTransactionId: string | null;
    sellerNotes: string | null;
  }
): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    `UPDATE orders
     SET status = 'shipped',
         carrier = $1,
         tracking_number = $2,
         tracking_url = $3,
         tracking_status = $4,
         shipping_eta = $5,
         shipping_label_url = $6,
         shipping_provider = $7,
         shipping_provider_shipment_id = $8,
         shipping_provider_rate_id = $9,
         shipping_provider_transaction_id = $10,
         seller_notes = $11,
         shipped_at = NOW()
     WHERE id = $12`,
    [
      input.carrier,
      input.trackingNumber,
      input.trackingUrl,
      input.trackingStatus,
      input.shippingEta,
      input.shippingLabelUrl,
      input.shippingProvider,
      input.shippingProviderShipmentId,
      input.shippingProviderRateId,
      input.shippingProviderTransactionId,
      input.sellerNotes,
      orderId
    ]
  );
}

export async function markOrderDelivered(orderId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query("UPDATE orders SET status = 'delivered', delivered_at = NOW() WHERE id = $1", [orderId]);
}

export async function updateOrderTrackingFromProvider(
  orderId: string,
  input: {
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    trackingStatus: string | null;
    shippingEta: string | null;
  }
): Promise<void> {
  await ensureSchema();

  const normalizedStatus = (input.trackingStatus || "").toUpperCase();
  const orderStatus =
    normalizedStatus === "DELIVERED"
      ? "delivered"
      : normalizedStatus
        ? "shipped"
        : null;

  await requirePool().query(
    `UPDATE orders
     SET carrier = COALESCE($1, carrier),
         tracking_number = COALESCE($2, tracking_number),
         tracking_url = COALESCE($3, tracking_url),
         tracking_status = COALESCE($4, tracking_status),
         shipping_eta = COALESCE($5::timestamptz, shipping_eta),
         status = CASE
           WHEN $6 = 'delivered' THEN 'delivered'
           WHEN $6 = 'shipped' AND status NOT IN ('delivered', 'canceled', 'refunded', 'failed') THEN 'shipped'
           ELSE status
         END,
         delivered_at = CASE
           WHEN $6 = 'delivered' AND delivered_at IS NULL THEN NOW()
           ELSE delivered_at
         END
     WHERE id = $7`,
    [
      input.carrier,
      input.trackingNumber,
      input.trackingUrl,
      input.trackingStatus,
      input.shippingEta,
      orderStatus,
      orderId
    ]
  );
}

export async function updateOrderIssue(
  orderId: string,
  status: OrderStatus,
  issueReason: string | null,
  sellerNotes: string | null
): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    "UPDATE orders SET status = $1, issue_reason = $2, seller_notes = $3 WHERE id = $4",
    [status, issueReason, sellerNotes, orderId]
  );
}

export async function markOrderPaidById(orderId: string, paymentMethod: Order["paymentMethod"]): Promise<void> {
  await ensureSchema();
  await requirePool().query("UPDATE orders SET status = 'paid', payment_method = $1 WHERE id = $2", [paymentMethod, orderId]);
}

export async function findOrderById(orderId: string): Promise<Order | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT
       orders.*,
       listings.returns_accepted,
       listings.status AS listing_status,
       order_reviews.overall_rating AS review_overall_rating,
       order_reviews.measurement_rating AS review_measurement_rating,
       order_reviews.condition_rating AS review_condition_rating,
       order_reviews.shipping_rating AS review_shipping_rating,
       order_reviews.communication_rating AS review_communication_rating,
       order_reviews.feedback AS review_feedback
     FROM orders
     LEFT JOIN listings ON listings.id = orders.listing_id
     LEFT JOIN order_reviews ON order_reviews.order_id = orders.id
     WHERE orders.id = $1`,
    [orderId]
  );
  return result.rows[0] ? mapOrder(result.rows[0]) : null;
}

export async function findOrderByShippingProviderTransactionId(transactionId: string): Promise<Order | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT
       orders.*,
       listings.returns_accepted,
       listings.status AS listing_status,
       order_reviews.overall_rating AS review_overall_rating,
       order_reviews.measurement_rating AS review_measurement_rating,
       order_reviews.condition_rating AS review_condition_rating,
       order_reviews.shipping_rating AS review_shipping_rating,
       order_reviews.communication_rating AS review_communication_rating,
       order_reviews.feedback AS review_feedback
     FROM orders
     LEFT JOIN listings ON listings.id = orders.listing_id
     LEFT JOIN order_reviews ON order_reviews.order_id = orders.id
     WHERE orders.shipping_provider_transaction_id = $1
     LIMIT 1`,
    [transactionId]
  );

  return result.rows[0] ? mapOrder(result.rows[0]) : null;
}

export async function findOrderByStripeCheckoutSessionId(sessionId: string): Promise<Order | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query("SELECT * FROM orders WHERE stripe_checkout_session_id = $1", [sessionId]);
  return result.rows[0] ? mapOrder(result.rows[0]) : null;
}

export async function listOrdersByStripeCheckoutSessionId(sessionId: string): Promise<Order[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();
  const result = await requirePool().query(
    "SELECT * FROM orders WHERE stripe_checkout_session_id = $1 ORDER BY created_at ASC",
    [sessionId]
  );
  return result.rows.map(mapOrder);
}

export async function markOrderPaidBySessionId(sessionId: string, paymentIntentId: string | null): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    "UPDATE orders SET status = 'processing', payment_method = 'stripe_checkout', stripe_payment_intent_id = $1 WHERE stripe_checkout_session_id = $2",
    [paymentIntentId, sessionId]
  );
}

export async function markOrderFailedBySessionId(sessionId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query("UPDATE orders SET status = 'failed' WHERE stripe_checkout_session_id = $1", [sessionId]);
}

export async function attachStripeSessionToOrder(orderId: string, sessionId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query("UPDATE orders SET stripe_checkout_session_id = $1 WHERE id = $2", [sessionId, orderId]);
}

export async function listBuyerOrders(userId: string): Promise<Order[]> {
  if (!databaseConfigured) {
    return [] as Order[];
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT
       orders.*,
       listings.returns_accepted,
       listings.status AS listing_status,
       order_reviews.overall_rating AS review_overall_rating,
       order_reviews.measurement_rating AS review_measurement_rating,
       order_reviews.condition_rating AS review_condition_rating,
       order_reviews.shipping_rating AS review_shipping_rating,
       order_reviews.communication_rating AS review_communication_rating,
       order_reviews.feedback AS review_feedback
     FROM orders
     LEFT JOIN listings ON listings.id = orders.listing_id
     LEFT JOIN order_reviews ON order_reviews.order_id = orders.id
     WHERE orders.buyer_id = $1
     ORDER BY orders.created_at DESC`,
    [userId]
  );
  return result.rows.map(mapOrder);
}

export async function findBuyerOrderForListing(buyerId: string, listingId: string): Promise<Order | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT
       orders.*,
       listings.returns_accepted,
       listings.status AS listing_status,
       order_reviews.overall_rating AS review_overall_rating,
       order_reviews.measurement_rating AS review_measurement_rating,
       order_reviews.condition_rating AS review_condition_rating,
       order_reviews.shipping_rating AS review_shipping_rating,
       order_reviews.communication_rating AS review_communication_rating,
       order_reviews.feedback AS review_feedback
     FROM orders
     LEFT JOIN listings ON listings.id = orders.listing_id
     LEFT JOIN order_reviews ON order_reviews.order_id = orders.id
     WHERE orders.buyer_id = $1
       AND orders.listing_id = $2
       AND orders.status NOT IN ('canceled', 'failed', 'refunded')
     ORDER BY orders.created_at DESC
     LIMIT 1`,
    [buyerId, listingId]
  );

  return result.rows[0] ? mapOrder(result.rows[0]) : null;
}

export async function findOrderReviewByOrderId(orderId: string): Promise<OrderReview | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query("SELECT * FROM order_reviews WHERE order_id = $1 LIMIT 1", [orderId]);
  return result.rows[0] ? mapOrderReview(result.rows[0]) : null;
}

export async function saveOrderReview(input: {
  orderId: string;
  buyerId: string;
  sellerId: string;
  overallRating: number | null;
  measurementRating: number | null;
  conditionRating: number | null;
  shippingRating: number | null;
  communicationRating: number | null;
  feedback: string;
}): Promise<OrderReview> {
  await ensureSchema();
  const result = await requirePool().query(
    `INSERT INTO order_reviews (
       order_id, buyer_id, seller_id, overall_rating, measurement_rating, condition_rating, shipping_rating, communication_rating, feedback, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
     ON CONFLICT (order_id) DO UPDATE SET
       overall_rating = EXCLUDED.overall_rating,
       measurement_rating = EXCLUDED.measurement_rating,
       condition_rating = EXCLUDED.condition_rating,
       shipping_rating = EXCLUDED.shipping_rating,
       communication_rating = EXCLUDED.communication_rating,
       feedback = EXCLUDED.feedback,
       updated_at = NOW()
     RETURNING *`,
    [
      input.orderId,
      input.buyerId,
      input.sellerId,
      input.overallRating,
      input.measurementRating,
      input.conditionRating,
      input.shippingRating,
      input.communicationRating,
      input.feedback
    ]
  );

  return mapOrderReview(result.rows[0]);
}

export async function getSellerReviewScores(sellerId: string): Promise<SellerReviewScores> {
  if (!databaseConfigured) {
    return {
      reviewCount: 0,
      overallScore: null,
      measurementAccuracyScore: null,
      conditionAccuracyScore: null,
      shippingSpeedHandlingScore: null,
      communicationScore: null
    };
  }

  await ensureSchema();
  const result = await requirePool().query<{
    review_count: string;
    overall_score: string | null;
    measurement_score: string | null;
    condition_score: string | null;
    shipping_score: string | null;
    communication_score: string | null;
  }>(
    `SELECT
       COUNT(*)::text AS review_count,
       ROUND(AVG(overall_rating)::numeric, 2)::text AS overall_score,
       ROUND(AVG(measurement_rating)::numeric, 2)::text AS measurement_score,
       ROUND(AVG(condition_rating)::numeric, 2)::text AS condition_score,
       ROUND(AVG(shipping_rating)::numeric, 2)::text AS shipping_score,
       ROUND(AVG(communication_rating)::numeric, 2)::text AS communication_score
     FROM order_reviews
     WHERE seller_id = $1`,
    [sellerId]
  );

  const row = result.rows[0];
  return {
    reviewCount: Number(row?.review_count ?? "0"),
    overallScore: row?.overall_score === null || row?.overall_score === undefined ? null : Number(row.overall_score),
    measurementAccuracyScore: row?.measurement_score === null || row?.measurement_score === undefined ? null : Number(row.measurement_score),
    conditionAccuracyScore: row?.condition_score === null || row?.condition_score === undefined ? null : Number(row.condition_score),
    shippingSpeedHandlingScore: row?.shipping_score === null || row?.shipping_score === undefined ? null : Number(row.shipping_score),
    communicationScore: row?.communication_score === null || row?.communication_score === undefined ? null : Number(row.communication_score)
  };
}

export async function listBuyerOffers(userId: string, status: OfferStatus | "all" = "all"): Promise<Offer[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();
  const result = await requirePool().query(
      `SELECT
        offers.*,
        buyer.username AS buyer_username,
        seller.username AS seller_username,
        listings.title AS listing_title,
        listings.price AS listing_price
       FROM offers
       INNER JOIN users AS buyer ON buyer.id = offers.buyer_id
       INNER JOIN users AS seller ON seller.id = offers.seller_id
       INNER JOIN listings ON listings.id = offers.listing_id
     WHERE offers.buyer_id = $1
       AND ($2::text = 'all' OR offers.status = $2)
     ORDER BY offers.updated_at DESC, offers.created_at DESC`,
    [userId, status]
  );

  return result.rows.map(mapOffer);
}

export async function listSellerOffers(userId: string, status: OfferStatus | "all" = "all"): Promise<Offer[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();
  const result = await requirePool().query(
      `SELECT
        offers.*,
         buyer.username AS buyer_username,
         seller.username AS seller_username,
         listings.title AS listing_title,
         listings.price AS listing_price
       FROM offers
       INNER JOIN users AS buyer ON buyer.id = offers.buyer_id
       INNER JOIN users AS seller ON seller.id = offers.seller_id
       INNER JOIN listings ON listings.id = offers.listing_id
      WHERE offers.seller_id = $1
        AND ($2::text = 'all' OR offers.status = $2)
      ORDER BY offers.updated_at DESC, offers.created_at DESC`,
    [userId, status]
  );

  return result.rows.map(mapOffer);
}

export async function createOffer(input: {
  buyerId: string;
  sellerId: string;
  listingId: string;
  amount: number;
  message: string | null;
}): Promise<Offer> {
  await ensureSchema();
  const client = requirePool();
  const id = randomUUID();
  const result = await client.query(
    `INSERT INTO offers (
       id, buyer_id, seller_id, listing_id, amount, status, message, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, 'active', $6, NOW(), NOW())
     RETURNING *`,
    [id, input.buyerId, input.sellerId, input.listingId, input.amount, input.message]
  );

  const hydrated = await client.query(
      `SELECT
        offers.*,
        buyer.username AS buyer_username,
        seller.username AS seller_username,
        listings.title AS listing_title,
        listings.price AS listing_price
       FROM offers
       INNER JOIN users AS buyer ON buyer.id = offers.buyer_id
       INNER JOIN users AS seller ON seller.id = offers.seller_id
       INNER JOIN listings ON listings.id = offers.listing_id
     WHERE offers.id = $1
     LIMIT 1`,
    [id]
  );

  return mapOffer(hydrated.rows[0] ?? result.rows[0]);
}

export async function listSellerOrders(userId: string): Promise<Order[]> {
  if (!databaseConfigured) {
    return [] as Order[];
  }

  await ensureSchema();
  const result = await requirePool().query("SELECT * FROM orders WHERE seller_id = $1 ORDER BY created_at DESC", [userId]);
  return result.rows.map(mapOrder);
}

export async function listUsers(): Promise<User[]> {
  if (!databaseConfigured) {
    return [] as User[];
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT users.*, buyer_profiles.height, buyer_profiles.weight, buyer_profiles.chest, buyer_profiles.shoulder, buyer_profiles.waist,
            buyer_profiles.sleeve, buyer_profiles.neck, buyer_profiles.inseam, buyer_profiles.fit_preference,
            buyer_profiles.max_alteration_budget, buyer_profiles.search_radius,
            buyer_profiles.jacket_measurements, buyer_profiles.shirt_measurements, buyer_profiles.waistcoat_measurements,
            buyer_profiles.trouser_measurements, buyer_profiles.coat_measurements, buyer_profiles.sweater_measurements,
            buyer_profiles.suggested_measurement_ranges,
            buyer_profiles.zip_code, buyer_profiles.location, buyer_profiles.address, buyer_profiles.addresses
     FROM users
     LEFT JOIN buyer_profiles ON buyer_profiles.user_id = users.id
     ORDER BY users.created_at DESC`
  );
  return result.rows.map(mapUser);
}

export async function listAllOrders(): Promise<Order[]> {
  if (!databaseConfigured) {
    return [] as Order[];
  }

  await ensureSchema();
  const result = await requirePool().query("SELECT * FROM orders ORDER BY created_at DESC");
  return result.rows.map(mapOrder);
}

export async function reserveListing(listingId: string): Promise<void> {
  await updateListingStatus(listingId, "reserved");
}

export async function markListingSold(listingId: string): Promise<void> {
  await updateListingStatus(listingId, "sold");
}

export async function reopenListing(listingId: string): Promise<void> {
  await updateListingStatus(listingId, "active");
}

export async function listMessageThreadsForUser(userId: string, options?: { unreadOnly?: boolean }): Promise<MessageThread[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT
       message_threads.*,
       buyer.username AS buyer_username,
       seller.username AS seller_username,
       listings.title AS listing_title,
       COALESCE(last_message.body, message_threads.subject) AS last_message_preview
     FROM message_threads
     INNER JOIN users AS buyer ON buyer.id = message_threads.buyer_id
     INNER JOIN users AS seller ON seller.id = message_threads.seller_id
     LEFT JOIN listings ON listings.id = message_threads.listing_id
     LEFT JOIN LATERAL (
       SELECT body
       FROM messages
       WHERE messages.thread_id = message_threads.id
       ORDER BY created_at DESC
       LIMIT 1
     ) AS last_message ON TRUE
     WHERE (message_threads.buyer_id = $1 OR message_threads.seller_id = $1)
       AND (
         (
           message_threads.buyer_id = $1
           AND (message_threads.buyer_deleted_at IS NULL OR message_threads.last_message_at > message_threads.buyer_deleted_at)
         ) OR (
           message_threads.seller_id = $1
           AND (message_threads.seller_deleted_at IS NULL OR message_threads.last_message_at > message_threads.seller_deleted_at)
         )
       )
       AND (
         $2::boolean = FALSE OR (
           (
             message_threads.buyer_id = $1
             AND message_threads.last_message_sender_id IS NOT NULL
             AND message_threads.last_message_sender_id <> $1
             AND (message_threads.buyer_last_read_at IS NULL OR message_threads.last_message_at > message_threads.buyer_last_read_at)
           ) OR (
             message_threads.seller_id = $1
             AND message_threads.last_message_sender_id IS NOT NULL
             AND message_threads.last_message_sender_id <> $1
             AND (message_threads.seller_last_read_at IS NULL OR message_threads.last_message_at > message_threads.seller_last_read_at)
           )
         )
       )
     ORDER BY message_threads.last_message_at DESC, message_threads.created_at DESC`,
    [userId, Boolean(options?.unreadOnly)]
  );

  return result.rows.map((row) => mapMessageThread(row, userId));
}

export async function findMessageThreadByIdForUser(userId: string, threadId: string): Promise<MessageThread | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT
       message_threads.*,
       buyer.username AS buyer_username,
       seller.username AS seller_username,
       listings.title AS listing_title,
       COALESCE(last_message.body, message_threads.subject) AS last_message_preview
     FROM message_threads
     INNER JOIN users AS buyer ON buyer.id = message_threads.buyer_id
     INNER JOIN users AS seller ON seller.id = message_threads.seller_id
     LEFT JOIN listings ON listings.id = message_threads.listing_id
     LEFT JOIN LATERAL (
       SELECT body
       FROM messages
       WHERE messages.thread_id = message_threads.id
       ORDER BY created_at DESC
       LIMIT 1
     ) AS last_message ON TRUE
     WHERE message_threads.id = $1
       AND (message_threads.buyer_id = $2 OR message_threads.seller_id = $2)
       AND (
         (
           message_threads.buyer_id = $2
           AND (message_threads.buyer_deleted_at IS NULL OR message_threads.last_message_at > message_threads.buyer_deleted_at)
         ) OR (
           message_threads.seller_id = $2
           AND (message_threads.seller_deleted_at IS NULL OR message_threads.last_message_at > message_threads.seller_deleted_at)
         )
       )
     LIMIT 1`,
    [threadId, userId]
  );

  return result.rows[0] ? mapMessageThread(result.rows[0], userId) : null;
}

export async function listMessagesForThread(threadId: string): Promise<Message[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT messages.*, users.username AS sender_username
     FROM messages
     INNER JOIN users ON users.id = messages.sender_id
     WHERE messages.thread_id = $1
     ORDER BY messages.created_at ASC`,
    [threadId]
  );

  return result.rows.map(mapMessage);
}

export async function getOrCreateListingMessageThread(input: {
  buyerId: string;
  sellerId: string;
  listingId: string;
  subject: string;
}): Promise<MessageThread> {
  await ensureSchema();
  const client = requirePool();
  const existing = await client.query(
    `SELECT
       message_threads.*,
       buyer.username AS buyer_username,
       seller.username AS seller_username,
       listings.title AS listing_title,
       COALESCE(last_message.body, message_threads.subject) AS last_message_preview
     FROM message_threads
     INNER JOIN users AS buyer ON buyer.id = message_threads.buyer_id
     INNER JOIN users AS seller ON seller.id = message_threads.seller_id
     LEFT JOIN listings ON listings.id = message_threads.listing_id
     LEFT JOIN LATERAL (
       SELECT body
       FROM messages
       WHERE messages.thread_id = message_threads.id
       ORDER BY created_at DESC
       LIMIT 1
     ) AS last_message ON TRUE
     WHERE message_threads.buyer_id = $1
       AND message_threads.seller_id = $2
       AND message_threads.listing_id = $3
       AND message_threads.order_id IS NULL
     LIMIT 1`,
    [input.buyerId, input.sellerId, input.listingId]
  );

  if (existing.rows[0]) {
    return mapMessageThread(existing.rows[0], input.buyerId);
  }

  const id = randomUUID();
  const created = await client.query(
    `INSERT INTO message_threads (
       id, buyer_id, seller_id, listing_id, order_id, subject, last_message_sender_id,
       buyer_last_read_at, seller_last_read_at, last_message_at, created_at
     ) VALUES ($1, $2, $3, $4, NULL, $5, NULL, NULL, NULL, NOW(), NOW())
     RETURNING *`,
    [id, input.buyerId, input.sellerId, input.listingId, input.subject]
  );

  const thread = created.rows[0];
  const hydrated = await client.query(
    `SELECT
       message_threads.*,
       buyer.username AS buyer_username,
       seller.username AS seller_username,
       listings.title AS listing_title,
       message_threads.subject AS last_message_preview
     FROM message_threads
     INNER JOIN users AS buyer ON buyer.id = message_threads.buyer_id
     INNER JOIN users AS seller ON seller.id = message_threads.seller_id
     LEFT JOIN listings ON listings.id = message_threads.listing_id
     WHERE message_threads.id = $1`,
    [thread.id]
  );

  return mapMessageThread(hydrated.rows[0], input.buyerId);
}

export async function createDirectMessageThread(input: {
  senderId: string;
  recipientId: string;
  subject: string;
}): Promise<MessageThread> {
  await ensureSchema();
  const client = requirePool();
  const id = randomUUID();

  await client.query(
    `INSERT INTO message_threads (
       id, buyer_id, seller_id, listing_id, order_id, subject, last_message_sender_id,
       buyer_last_read_at, seller_last_read_at, last_message_at, created_at
     ) VALUES ($1, $2, $3, NULL, NULL, $4, NULL, NULL, NULL, NOW(), NOW())`,
    [id, input.senderId, input.recipientId, input.subject]
  );

  const hydrated = await client.query(
    `SELECT
       message_threads.*,
       buyer.username AS buyer_username,
       seller.username AS seller_username,
       listings.title AS listing_title,
       message_threads.subject AS last_message_preview
     FROM message_threads
     INNER JOIN users AS buyer ON buyer.id = message_threads.buyer_id
     INNER JOIN users AS seller ON seller.id = message_threads.seller_id
     LEFT JOIN listings ON listings.id = message_threads.listing_id
     WHERE message_threads.id = $1`,
    [id]
  );

  return mapMessageThread(hydrated.rows[0], input.senderId);
}

export async function sendMessageInThread(input: {
  threadId: string;
  senderId: string;
  body: string;
}): Promise<Message> {
  await ensureSchema();
  const client = requirePool();
  const id = randomUUID();
  const result = await client.query(
    `INSERT INTO messages (id, thread_id, sender_id, body, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [id, input.threadId, input.senderId, input.body]
  );

  const threadResult = await client.query(
    "SELECT buyer_id, seller_id FROM message_threads WHERE id = $1 LIMIT 1",
    [input.threadId]
  );
  const thread = threadResult.rows[0];

  if (thread) {
    const isBuyerSender = String(thread.buyer_id) === input.senderId;
    await client.query(
      `UPDATE message_threads
       SET last_message_at = NOW(),
           last_message_sender_id = $2,
           buyer_last_read_at = CASE WHEN $3 THEN NOW() ELSE buyer_last_read_at END,
           seller_last_read_at = CASE WHEN $3 THEN seller_last_read_at ELSE NOW() END,
           buyer_deleted_at = NULL,
           seller_deleted_at = NULL
       WHERE id = $1`,
      [input.threadId, input.senderId, isBuyerSender]
    );
  }

  const hydrated = await client.query(
    `SELECT messages.*, users.username AS sender_username
     FROM messages
     INNER JOIN users ON users.id = messages.sender_id
     WHERE messages.id = $1
     LIMIT 1`,
    [id]
  );

  return mapMessage(hydrated.rows[0] ?? result.rows[0]);
}

export async function markMessageThreadReadForUser(userId: string, threadId: string): Promise<void> {
  await ensureSchema();
  const client = requirePool();
  const threadResult = await client.query(
    "SELECT buyer_id, seller_id FROM message_threads WHERE id = $1 LIMIT 1",
    [threadId]
  );
  const thread = threadResult.rows[0];

  if (!thread) {
    return;
  }

  if (String(thread.buyer_id) === userId) {
    await client.query("UPDATE message_threads SET buyer_last_read_at = NOW() WHERE id = $1", [threadId]);
  } else if (String(thread.seller_id) === userId) {
    await client.query("UPDATE message_threads SET seller_last_read_at = NOW() WHERE id = $1", [threadId]);
  }
}

export async function deleteMessageThreadForUser(userId: string, threadId: string): Promise<boolean> {
  if (!databaseConfigured) {
    return false;
  }

  await ensureSchema();
  const client = requirePool();
  const threadResult = await client.query(
    "SELECT buyer_id, seller_id FROM message_threads WHERE id = $1 LIMIT 1",
    [threadId]
  );
  const thread = threadResult.rows[0];

  if (!thread) {
    return false;
  }

  if (String(thread.buyer_id) === userId) {
    await client.query(
      "UPDATE message_threads SET buyer_deleted_at = NOW(), buyer_last_read_at = NOW() WHERE id = $1",
      [threadId]
    );
    return true;
  }

  if (String(thread.seller_id) === userId) {
    await client.query(
      "UPDATE message_threads SET seller_deleted_at = NOW(), seller_last_read_at = NOW() WHERE id = $1",
      [threadId]
    );
    return true;
  }

  return false;
}

export async function restoreMessageThreadForUser(userId: string, threadId: string): Promise<boolean> {
  if (!databaseConfigured) {
    return false;
  }

  await ensureSchema();
  const client = requirePool();
  const threadResult = await client.query(
    "SELECT buyer_id, seller_id FROM message_threads WHERE id = $1 LIMIT 1",
    [threadId]
  );
  const thread = threadResult.rows[0];

  if (!thread) {
    return false;
  }

  if (String(thread.buyer_id) === userId) {
    await client.query("UPDATE message_threads SET buyer_deleted_at = NULL WHERE id = $1", [threadId]);
    return true;
  }

  if (String(thread.seller_id) === userId) {
    await client.query("UPDATE message_threads SET seller_deleted_at = NULL WHERE id = $1", [threadId]);
    return true;
  }

  return false;
}

export async function countUnreadMessageThreadsForUser(userId: string): Promise<number> {
  if (!databaseConfigured) {
    return 0;
  }

  await ensureSchema();
  const result = await requirePool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM message_threads
     WHERE (
       buyer_id = $1
       AND (buyer_deleted_at IS NULL OR last_message_at > buyer_deleted_at)
       AND last_message_sender_id IS NOT NULL
       AND last_message_sender_id <> $1
       AND (buyer_last_read_at IS NULL OR last_message_at > buyer_last_read_at)
     ) OR (
       seller_id = $1
       AND (seller_deleted_at IS NULL OR last_message_at > seller_deleted_at)
       AND last_message_sender_id IS NOT NULL
       AND last_message_sender_id <> $1
       AND (seller_last_read_at IS NULL OR last_message_at > seller_last_read_at)
     )`,
    [userId]
  );

  return Number(result.rows[0]?.count ?? "0");
}

export async function isFollowingUser(followerId: string, followedId: string): Promise<boolean> {
  if (!databaseConfigured) {
    return false;
  }

  await ensureSchema();
  const result = await requirePool().query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM user_follows
       WHERE follower_id = $1 AND followed_id = $2
     ) AS exists`,
    [followerId, followedId]
  );

  return Boolean(result.rows[0]?.exists);
}

export async function followUser(followerId: string, followedId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    `INSERT INTO user_follows (follower_id, followed_id, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (follower_id, followed_id) DO NOTHING`,
    [followerId, followedId]
  );
}

export async function unfollowUser(followerId: string, followedId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    "DELETE FROM user_follows WHERE follower_id = $1 AND followed_id = $2",
    [followerId, followedId]
  );
}

export async function listFollowerUsersForSeller(followedId: string): Promise<User[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT users.*, buyer_profiles.height, buyer_profiles.weight, buyer_profiles.chest, buyer_profiles.shoulder, buyer_profiles.waist,
            buyer_profiles.sleeve, buyer_profiles.neck, buyer_profiles.inseam, buyer_profiles.fit_preference,
            buyer_profiles.max_alteration_budget, buyer_profiles.search_radius,
            buyer_profiles.zip_code, buyer_profiles.location, buyer_profiles.address, buyer_profiles.addresses,
            buyer_profiles.jacket_measurements, buyer_profiles.shirt_measurements, buyer_profiles.waistcoat_measurements,
            buyer_profiles.trouser_measurements, buyer_profiles.coat_measurements, buyer_profiles.sweater_measurements,
            buyer_profiles.suggested_measurement_ranges
     FROM user_follows
     INNER JOIN users ON users.id = user_follows.follower_id
     LEFT JOIN buyer_profiles ON buyer_profiles.user_id = users.id
     WHERE user_follows.followed_id = $1
     ORDER BY user_follows.created_at DESC`,
    [followedId]
  );

  return result.rows.map(mapUser);
}

export async function hasNotificationDelivery(eventKey: string): Promise<boolean> {
  if (!databaseConfigured) {
    return false;
  }

  await ensureSchema();
  const result = await requirePool().query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM notification_deliveries
       WHERE event_key = $1
     ) AS exists`,
    [eventKey]
  );

  return Boolean(result.rows[0]?.exists);
}

export async function recordNotificationDelivery(input: {
  eventKey: string;
  channel: "email" | "sms";
  recipient: string;
  eventType: string;
}): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    `INSERT INTO notification_deliveries (event_key, channel, recipient, event_type, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (event_key) DO NOTHING`,
    [input.eventKey, input.channel, input.recipient, input.eventType]
  );
}

export async function listSavedUsersForUser(userId: string): Promise<User[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT users.*, buyer_profiles.height, buyer_profiles.weight, buyer_profiles.chest, buyer_profiles.shoulder, buyer_profiles.waist,
            buyer_profiles.sleeve, buyer_profiles.neck, buyer_profiles.inseam, buyer_profiles.fit_preference,
            buyer_profiles.max_alteration_budget, buyer_profiles.search_radius,
            buyer_profiles.zip_code, buyer_profiles.location, buyer_profiles.address, buyer_profiles.addresses,
            buyer_profiles.jacket_measurements, buyer_profiles.shirt_measurements, buyer_profiles.waistcoat_measurements,
            buyer_profiles.trouser_measurements, buyer_profiles.coat_measurements, buyer_profiles.sweater_measurements,
            buyer_profiles.suggested_measurement_ranges
     FROM user_follows
     INNER JOIN users ON users.id = user_follows.followed_id
     LEFT JOIN buyer_profiles ON buyer_profiles.user_id = users.id
     WHERE user_follows.follower_id = $1
     ORDER BY user_follows.created_at DESC`,
    [userId]
  );

  return result.rows.map(mapUser);
}

export async function getUserFollowCounts(userId: string): Promise<{ followerCount: number; followingCount: number }> {
  if (!databaseConfigured) {
    return { followerCount: 0, followingCount: 0 };
  }

  await ensureSchema();
  const [followersResult, followingResult] = await Promise.all([
    requirePool().query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM user_follows WHERE followed_id = $1",
      [userId]
    ),
    requirePool().query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM user_follows WHERE follower_id = $1",
      [userId]
    )
  ]);

  return {
    followerCount: Number(followersResult.rows[0]?.count ?? "0"),
    followingCount: Number(followingResult.rows[0]?.count ?? "0")
  };
}

export async function isListingSavedByUser(userId: string, listingId: string): Promise<boolean> {
  if (!databaseConfigured) {
    return false;
  }

  await ensureSchema();
  const result = await requirePool().query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM user_saved_listings
       WHERE user_id = $1 AND listing_id = $2
     ) AS exists`,
    [userId, listingId]
  );

  return Boolean(result.rows[0]?.exists);
}

export async function saveListingForUser(userId: string, listingId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    `INSERT INTO user_saved_listings (user_id, listing_id, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, listing_id) DO NOTHING`,
    [userId, listingId]
  );
}

export async function unsaveListingForUser(userId: string, listingId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    "DELETE FROM user_saved_listings WHERE user_id = $1 AND listing_id = $2",
    [userId, listingId]
  );
}

export async function listSavedListingsForUser(userId: string): Promise<Listing[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT listings.*
     FROM user_saved_listings
     INNER JOIN listings ON listings.id = user_saved_listings.listing_id
     WHERE user_saved_listings.user_id = $1
     ORDER BY user_saved_listings.created_at DESC`,
    [userId]
  );

  return result.rows.map(mapListing);
}

export async function listListingsFromFollowedUsers(userId: string, limit = 24): Promise<Listing[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT listings.*
     FROM user_follows
     INNER JOIN listings ON listings.seller_id = user_follows.followed_id
     WHERE user_follows.follower_id = $1
       AND listings.status = 'active'
     ORDER BY listings.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map(mapListing);
}

export async function listSavedSearchesForUser(userId: string): Promise<SavedSearch[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();
  const result = await requirePool().query(
    `SELECT *
     FROM user_saved_searches
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows.map(mapSavedSearch);
}

export async function createSavedSearch(input: {
  userId: string;
  name: string;
  queryString: string;
}): Promise<SavedSearch> {
  await ensureSchema();
  const client = requirePool();
  const id = randomUUID();
  const result = await client.query(
    `INSERT INTO user_saved_searches (id, user_id, name, query_string, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [id, input.userId, input.name, input.queryString]
  );

  return mapSavedSearch(result.rows[0]);
}

export async function updateSavedSearchName(userId: string, savedSearchId: string, name: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    `UPDATE user_saved_searches
     SET name = $1
     WHERE id = $2 AND user_id = $3`,
    [name, savedSearchId, userId]
  );
}

export async function updateSavedSearchQuery(userId: string, savedSearchId: string, queryString: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    `UPDATE user_saved_searches
     SET query_string = $1
     WHERE id = $2 AND user_id = $3`,
    [queryString, savedSearchId, userId]
  );
}

export async function deleteSavedSearch(userId: string, savedSearchId: string): Promise<void> {
  await ensureSchema();
  await requirePool().query(
    "DELETE FROM user_saved_searches WHERE id = $1 AND user_id = $2",
    [savedSearchId, userId]
  );
}

export function isDatabaseConfigured() {
  return databaseConfigured;
}

export { emptyShippingAddress };
