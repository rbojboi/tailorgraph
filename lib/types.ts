export type Role = "buyer" | "seller" | "both";

export type PublicLocationMode = "hidden" | "city_state_country" | "state_country" | "country";

export type BuyerFitPreference = "trim" | "classic" | "relaxed";

export type MeasurementConfidence = "low" | "medium" | "high";

export type MeasurementRange = {
  min: number;
  max: number;
  confidence: MeasurementConfidence;
};

export type BuyerTopMeasurementRanges = {
  neck?: MeasurementRange;
  chest: MeasurementRange;
  waist: MeasurementRange;
  shoulders: MeasurementRange;
  bodyLength: MeasurementRange;
  sleeveLength: MeasurementRange;
};

export type BuyerWaistcoatMeasurementRanges = {
  chest: MeasurementRange;
  waist: MeasurementRange;
  shoulders: MeasurementRange;
  bodyLength: MeasurementRange;
};

export type BuyerTrouserMeasurementRanges = {
  waist: MeasurementRange;
  hips: MeasurementRange;
  inseam: MeasurementRange;
  outseam: MeasurementRange;
  opening: MeasurementRange;
};

export type BuyerSuggestedMeasurementRanges = {
  fitPreference: BuyerFitPreference;
  jacket: BuyerTopMeasurementRanges | null;
  shirt: BuyerTopMeasurementRanges | null;
  coat: BuyerTopMeasurementRanges | null;
  sweater: Omit<BuyerTopMeasurementRanges, "neck"> | null;
  trousers: BuyerTrouserMeasurementRanges | null;
  waistcoat: BuyerWaistcoatMeasurementRanges | null;
};

export type BuyerJacketMeasurements = Partial<JacketMeasurements>;
export type BuyerWaistcoatMeasurements = Partial<WaistcoatMeasurements>;
export type BuyerTrouserMeasurements = Partial<TrouserMeasurements>;

export type BuyerProfile = {
  zipCode: string;
  location: string;
  address: ShippingAddress;
  addresses: ShippingAddress[];
  height: number;
  weight: number;
  chest: number;
  shoulder: number;
  waist: number;
  sleeve: number;
  neck: number;
  inseam: number;
  fitPreference: BuyerFitPreference;
  maxAlterationBudget: number;
  searchRadius: number;
  jacketMeasurements: BuyerJacketMeasurements | null;
  shirtMeasurements: BuyerJacketMeasurements | null;
  waistcoatMeasurements: BuyerWaistcoatMeasurements | null;
  trouserMeasurements: BuyerTrouserMeasurements | null;
  coatMeasurements: BuyerJacketMeasurements | null;
  sweaterMeasurements: BuyerJacketMeasurements | null;
  suggestedMeasurementRanges: BuyerSuggestedMeasurementRanges | null;
};

export type NotificationPreferences = {
  messagesEmail: boolean;
  fitEmail: boolean;
  savedSearchEmail: boolean;
  savedSellerEmail: boolean;
  savedItemEmail: boolean;
  offerAndPriceDropEmail: boolean;
  sellerActivityEmail: boolean;
  helloEmail: boolean;
  updatesEmail: boolean;
  shipmentSms: boolean;
};

export type User = {
  id: string;
  name: string;
  username: string;
  businessName: string;
  profileDescription: string;
  showPersonalNameOnProfile: boolean;
  showBusinessNameOnProfile: boolean;
  publicLocationMode: PublicLocationMode;
  email: string;
  emailVerified: boolean;
  phoneNumber: string;
  passwordHash: string;
  role: Role;
  sellerZipCode: string;
  sellerLocation: string;
  marketplaceIntroDismissed: boolean;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  notificationPreferences: NotificationPreferences;
  buyerProfile: BuyerProfile;
  createdAt: string;
};

export type ListingMedia = {
  url: string;
  kind: "image" | "video";
  originalName: string;
  mimeType: string;
};

export type JacketMeasurements = {
  neck?: number;
  chest: number;
  waist: number;
  shoulders: number;
  bodyLength: number;
  sleeveLength: number;
  sleeveLengthAllowance: number;
};

export type JacketSpecs = {
  cut: "single_breasted" | "double_breasted";
  lapel: "notch" | "peak" | "shawl";
  buttonStyle: "1_button" | "2_buttons" | "3_buttons" | "4_buttons" | "5_buttons" | "6_buttons" | "8_buttons";
  ventStyle: "unvented" | "single_vented" | "double_vented";
  canvas: "full" | "half" | "uncanvassed" | "fused" | "unknown";
  lining: "full" | "half" | "unlined";
  formal: "black_tie" | "white_tie" | "morning_dress" | "na";
};

export type ShirtSpecs = {
  collarStyle:
    | "spread"
    | "point"
    | "button_down"
    | "club"
    | "band"
    | "wing"
    | "cutaway"
    | "tab";
  cuffStyle: "barrel" | "french" | "convertible";
  placket: "standard" | "hidden" | "studs" | "none";
};

export type SweaterSpecs = {
  neckline:
    | "crew_neck"
    | "v_neck"
    | "turtleneck"
    | "mock_neck"
    | "shawl_collar"
    | "polo_collar"
    | "boat_neck"
    | "hooded"
    | "roll_neck";
  closure: "none" | "quarter_zip" | "half_zip" | "full_zip" | "button_front" | "toggle_front";
};

export type WaistcoatMeasurements = {
  chest: number;
  waist: number;
  shoulders: number;
  bodyLength: number;
};

export type WaistcoatSpecs = {
  cut: "single_breasted" | "double_breasted";
  lapel: "notch" | "peak" | "shawl" | "na";
  formal: "black_tie" | "white_tie" | "morning_dress" | "na";
};

export type TrouserMeasurements = {
  waist: number;
  waistAllowance: number;
  hips: number;
  inseam: number;
  inseamOutseamAllowance: number;
  outseam: number;
  opening: number;
};

export type TrouserSpecs = {
  cut: "wide" | "straight" | "tapered" | "slim";
  front: "flat" | "pleated";
  formal: "black_tie" | "white_tie" | "morning_dress" | "na";
};

export type ShippingAddress = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type ListingStatus = "draft" | "active" | "reserved" | "sold" | "archived";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "issue_open"
  | "canceled"
  | "refunded"
  | "failed";

export type OfferStatus = "active" | "accepted" | "rejected";

export type SupportRequestKind = "support" | "dispute";

export type SupportRequestTopic =
  | "account_access"
  | "buying"
  | "selling"
  | "shipping_returns"
  | "fit_measurements"
  | "trust_safety"
  | "order_dispute"
  | "damaged_return"
  | "shipping_problem"
  | "scam_report"
  | "other";

export type SupportRequestStatus = "open" | "reviewing" | "resolved";

export type Listing = {
  id: string;
  sellerId: string;
  sellerDisplayName: string;
  title: string;
  brand: string;
  category: "jacket" | "two_piece_suit" | "three_piece_suit" | "waistcoat" | "trousers" | "coat" | "shirt" | "sweater";
  sizeLabel: string;
  trouserSizeLabel: string;
  chest: number;
  shoulder: number;
  waist: number;
  sleeve: number;
  inseam: number;
  outseam: number;
  material:
    | "unknown"
    | "angora"
    | "alpaca"
    | "camel"
    | "cashmere"
    | "cashmere_blend"
    | "covert"
    | "cotton"
    | "cotton_blend"
    | "denim"
    | "flannel"
    | "fresco"
    | "fur"
    | "faux_fur"
    | "gabardine"
    | "leather"
    | "faux_leather"
    | "linen"
    | "linen_blend"
    | "melton"
    | "mohair"
    | "mohair_blend"
    | "quilted"
    | "shearling"
    | "silk"
    | "silk_blend"
    | "suede"
    | "synthetic"
    | "technical"
    | "tweed"
    | "velvet"
    | "synthetic_blend"
    | "lambswool"
    | "merino"
    | "wool"
    | "wool_blend"
    | "worsted"
    | "yak"
    | "other";
  pattern:
    | "birdseye"
    | "check"
    | "color_block"
    | "fair_isle"
    | "fleck"
    | "gingham"
    | "heathered"
    | "herringbone"
    | "houndstooth"
    | "medium_stripe"
    | "micropattern"
    | "nailhead"
    | "nordic"
    | "plaid"
    | "plaid_tartan"
    | "print_novelty"
    | "solid"
    | "striped"
    | "tattersall"
    | "thin_stripe"
    | "university_stripe"
    | "wide_stripe"
    | "windowpane"
    | "bengal_stripe"
    | "pencil_stripe"
    | "other";
  primaryColor:
    | "beige_tan"
    | "black"
    | "blue"
    | "brown"
    | "gray_charcoal"
    | "green"
    | "navy"
    | "orange"
    | "pink"
    | "purple_violet"
    | "white_cream"
    | "yellow";
  countryOfOrigin:
      | "unknown"
      | "other"
      | "austria"
      | "belgium"
      | "brazil"
      | "bulgaria"
      | "cambodia"
      | "canada"
      | "china"
      | "colombia"
      | "czechia"
      | "denmark"
      | "dominican_republic"
      | "egypt"
      | "france"
      | "germany"
      | "hong_kong"
      | "hungary"
      | "india"
      | "indonesia"
      | "ireland"
      | "israel"
      | "italy"
      | "japan"
      | "jordan"
      | "madagascar"
      | "malaysia"
      | "mauritius"
      | "mexico"
      | "mongolia"
      | "netherlands"
      | "norway"
      | "pakistan"
      | "peru"
      | "philippines"
      | "poland"
      | "portugal"
      | "romania"
      | "russia_ussr"
      | "south_korea"
      | "spain"
      | "sri_lanka"
      | "sweden"
      | "switzerland"
      | "taiwan"
      | "thailand"
      | "tunisia"
      | "turkey"
      | "united_kingdom"
      | "united_states"
      | "vietnam";
  lapel: "notch" | "peak" | "shawl";
  fabricWeight: "light" | "medium" | "heavy";
  fabricType:
    | "aran"
    | "cable_knit"
    | "broadcloth_poplin"
    | "boucle"
    | "chambray"
    | "corduroy"
    | "denim"
    | "dobby"
    | "end_on_end"
    | "fine_knit"
    | "fishermans_rib"
    | "fisherman"
    | "flannel"
    | "fleece"
    | "herringbone"
    | "interlock"
    | "jacquard"
    | "jersey"
    | "jersey_knit"
    | "oxford"
    | "pinpoint"
    | "pique"
    | "pointelle"
    | "rib"
    | "rib_knit"
    | "shaker_knit"
    | "seersucker"
    | "terry"
    | "twill"
    | "velvet"
    | "waffle_knit"
    | "other"
    | "na";
  fabricWeave:
    | "broadcloth"
    | "cambric"
    | "chambray"
    | "dobby"
    | "end_on_end"
    | "flannel"
    | "herringbone"
    | "oxford"
    | "pinpoint"
    | "poplin"
    | "seersucker"
    | "twill"
    | "na";
  condition:
    | "new_with_tags"
    | "new_without_tags"
    | "used_excellent"
    | "used_very_good"
    | "used_good"
    | "used_fair"
    | "used_poor";
  vintage: "modern" | "vintage_1970_2000" | "vintage_1940_1970" | "vintage_pre_1940";
  returnsAccepted: boolean;
  allowOffers: boolean;
  price: number;
  shippingPrice: number;
  shippingIncluded: false;
  shippingMethod: "ship";
  processingDays: number;
  location: string;
  distanceMiles: number;
  description: string;
  media: ListingMedia[];
  jacketMeasurements: JacketMeasurements | null;
  jacketSpecs: JacketSpecs | null;
  shirtSpecs: ShirtSpecs | null;
  sweaterSpecs: SweaterSpecs | null;
  waistcoatMeasurements: WaistcoatMeasurements | null;
  waistcoatSpecs: WaistcoatSpecs | null;
  trouserMeasurements: TrouserMeasurements | null;
  trouserSpecs: TrouserSpecs | null;
  status: ListingStatus;
  createdAt: string;
};

export type Order = {
  id: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  listingId: string;
  listingTitle: string;
  amount: number;
  subtotal: number;
  shippingAmount: number;
  paymentMethod: "card" | "bank" | "wallet" | "stripe_checkout";
  status: OrderStatus;
  listingStatus: ListingStatus | null;
  returnsAccepted: boolean;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  shippingAddress: ShippingAddress;
  shippingMethod: "ship";
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  trackingStatus: string | null;
  shippingEta: string | null;
  shippingLabelUrl: string | null;
  shippingProvider: string | null;
  shippingProviderShipmentId: string | null;
  shippingProviderRateId: string | null;
  shippingProviderTransactionId: string | null;
  issueReason: string | null;
  sellerNotes: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  reviewOverallRating: number | null;
  reviewMeasurementRating: number | null;
  reviewConditionRating: number | null;
  reviewShippingRating: number | null;
  reviewCommunicationRating: number | null;
  reviewFeedback: string;
  createdAt: string;
};

export type OrderReview = {
  orderId: string;
  buyerId: string;
  sellerId: string;
  overallRating: number | null;
  measurementRating: number | null;
  conditionRating: number | null;
  shippingRating: number | null;
  communicationRating: number | null;
  feedback: string;
  createdAt: string;
  updatedAt: string;
};

export type SellerReviewScores = {
  reviewCount: number;
  overallScore: number | null;
  measurementAccuracyScore: number | null;
  conditionAccuracyScore: number | null;
  shippingSpeedHandlingScore: number | null;
  communicationScore: number | null;
};

export type Offer = {
  id: string;
  buyerId: string;
  buyerUsername: string;
  sellerId: string;
  sellerUsername: string;
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  amount: number;
  status: OfferStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageThread = {
  id: string;
  buyerId: string;
  buyerUsername: string;
  sellerId: string;
  sellerUsername: string;
  listingId: string | null;
  listingTitle: string | null;
  orderId: string | null;
  subject: string;
  lastMessagePreview: string;
  unread: boolean;
  lastMessageAt: string;
  createdAt: string;
};

export type Message = {
  id: string;
  threadId: string;
  senderId: string;
  senderUsername: string;
  body: string;
  createdAt: string;
};

export type SavedSearch = {
  id: string;
  userId: string;
  name: string;
  queryString: string;
  createdAt: string;
};

export type SupportRequest = {
  id: string;
  userId: string | null;
  requesterName: string;
  requesterEmail: string;
  requesterRole: Role | "guest";
  kind: SupportRequestKind;
  topic: SupportRequestTopic;
  subject: string;
  message: string;
  orderId: string | null;
  listingId: string | null;
  status: SupportRequestStatus;
  createdAt: string;
  resolvedAt: string | null;
};
