import Image from "next/image";
import Link from "next/link";
import { AppShell, PageWrap, SectionTitle } from "@/components/ui";

const measurementGuides = [
  {
    title: "Jacket",
    image: "/jacket-schematic.png",
    alt: "Jacket measuring schematic showing chest, waist, shoulders, arm length, and body length",
    notes: [
      "Lay the jacket flat, measure straight across the chest from armpit to armpit on the front of the jacket.",
      "Measure straight across the narrowest part of the jacket body on the front.",
      "Measure across from shoulder seam to shoulder seam on the back.",
      "Measure straight from the base of the collar to the hem on the back.",
      "Measure from the top shoulder seam down to the end of the cuff.",
      "Measure inside the sleeve from the end of the cuff to the furthest point where exterior fabric extends inside. A flashlight can help reveal the full allowance where the lining covers it."
    ]
  },
  {
    title: "Waistcoat",
    image: "/waistcoat-schematic.png",
    alt: "Waistcoat measuring schematic showing chest, waist, shoulders, and body length",
    notes: [
      "Lay the waistcoat flat, measure straight across the chest at the widest point on the front.",
      "Measure straight across the narrowest part of the waistcoat body on the front.",
      "Measure across from shoulder point to shoulder point on the back.",
      "Measure from the top of the shoulder down to the bottom hem on the back."
    ]
  },
  {
    title: "Trousers",
    image: "/trousers-schematic.png",
    alt: "Trouser measuring schematic showing waist, hips, inseam, outseam, and opening",
    notes: [
      "Button the trousers, lay them flat, measure straight across the waistband.",
      "Measure only how much allowance there is on each side of the back seam, meaning half of the total available waist allowance.",
      "Measure across the fullest part of the seat or hips.",
      "Measure from the crotch seam down the inside leg to the hem.",
      "Measure from the top of the waistband down the outside leg to the hem.",
      "Include all fabric that can be obtained by eliminating a trousers' cuff, along with any additional fabric available for lengthening.",
      "Measure straight across the bottom hem opening."
    ]
  },
  {
    title: "Coat",
    image: "/coat-schematics.png",
    alt: "Coat measuring schematic showing chest, waist, shoulders, arm length, and body length",
    notes: [
      "Lay the coat flat, measure straight across the chest from armpit to armpit on the front of the coat.",
      "Measure straight across the narrowest part of the coat body on the front.",
      "Measure across from shoulder seam to shoulder seam on the back.",
      "Measure straight from the base of the collar to the hem on the back.",
      "Measure from the top shoulder seam down to the end of the cuff.",
      "Measure inside the sleeve from the end of the cuff to the furthest point where exterior fabric extends inside. A flashlight can help reveal the full allowance where the lining covers it."
    ]
  }
];

export default function HowToUsePage() {
  return (
    <AppShell>
      <PageWrap maxWidth="max-w-6xl">
        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <SectionTitle
            eyebrow="Guide"
            title="How to Use TailorGraph"
            description="A fit-first walkthrough for buyers and sellers, including how to measure garments correctly."
          />

          <div className="mt-8 grid gap-6">
            <article className="rounded-[1.5rem] border border-stone-300 bg-white p-6">
              <h2 className="text-xl font-semibold text-stone-950">How the Marketplace Works</h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                TailorGraph is built around real garment measurements rather than tagged sizes alone. Buyers can save their usual measurements, search within ranges, and include alteration allowances where relevant. Sellers can create structured listings with precise menswear-specific measurements and specifications so buyers can shop with more confidence.
              </p>
            </article>

            <details className="rounded-[1.5rem] border border-stone-300 bg-white p-6">
              <summary className="cursor-pointer list-none text-xl font-semibold text-stone-950">
                How to Measure Properly
              </summary>
              <p className="mt-4 text-sm leading-7 text-stone-700">
                Both buyers and sellers should measure as described in this section. Buyers should use these measurement points when saving their usual garment measurements, and sellers should use the same points when listing an item for sale. To determine what measurements would fit them best, buyers should measure an actual garment that already fits well, not the body directly. Sellers should measure garments before they list them.
              </p>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                To measure, lay the garment flat on a smooth surface, button or fasten it where appropriate, and use a soft measuring tape. Measure carefully and enter your values in quarter-inch increments where needed.
              </p>
              <div className="mt-6 grid gap-6">
                <section className="ml-4 grid gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-stone-950">A Few Practical Tips</h2>
                    <p className="mt-3 text-sm leading-7 text-stone-700">
                      Measure twice before saving a buyer profile or publishing a listing. If a garment has tailoring allowance, include that separately where the listing details ask for it. Buyers can then decide whether to search only by current measurements or to include alterable pieces too.
                    </p>
                  </div>
                </section>

                {measurementGuides.map((guide) => (
                  <section key={guide.title} className="ml-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                    <div>
                      <h2 className="text-xl font-semibold text-stone-950">{guide.title}</h2>
                      <div className="mt-3 grid gap-1.5">
                        {guide.notes.map((note, index) => {
                          const labels =
                            guide.title === "Jacket"
                              ? [
                                  "Chest:",
                                  "Waist:",
                                  "Shoulders:",
                                  "Body Length:",
                                  "Arm Length:",
                                  "Arm Length Allowance:"
                                ]
                              : guide.title === "Waistcoat"
                                ? ["Chest:", "Waist:", "Shoulders:", "Body Length:"]
                              : guide.title === "Trousers"
                                  ? ["Waist:", "Waist Allowance:", "Hips:", "Inseam:", "Outseam:", "Inseam/Outseam Allowance:", "Opening:"]
                                  : ["Chest:", "Waist:", "Shoulders:", "Body Length:", "Arm Length:", "Arm Length Allowance:"];

                          return (
                          <p key={`${guide.title}-${labels[index]}`} className="text-sm leading-7 text-stone-700">
                            <strong>{labels[index]} </strong>
                            {note}
                          </p>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <Image
                        src={guide.image}
                        alt={guide.alt}
                        width={900}
                        height={700}
                        className={
                          guide.title === "Coat"
                            ? "h-auto w-full object-contain"
                            : guide.title === "Trousers"
                              ? "h-80 w-full object-cover object-top"
                              : guide.title === "Waistcoat"
                              ? "h-56 w-full object-cover object-top"
                              : "h-64 w-full object-cover object-top"
                        }
                      />
                    </div>
                  </section>
                ))}
              </div>
            </details>

            <details className="rounded-[1.5rem] border border-stone-300 bg-white p-6">
              <summary className="cursor-pointer list-none text-xl font-semibold text-stone-950">
                How to Search the Marketplace
              </summary>
              <div className="mt-4 grid gap-4">
                <p className="text-sm leading-7 text-stone-700">
                  Start by selecting the garment type you want to shop for, then narrow results using fabric, condition, color, and other garment-specific attributes. The filter column is designed so buyers can move from broad browsing into more precise fit-first shopping.
                </p>
                <p className="text-sm leading-7 text-stone-700">
                  If you already know your preferred measurements, you can search with exact values or ranges. If you are browsing more generally, you can begin with category and material filters, then narrow further as you review available listings.
                </p>
                <p className="text-sm leading-7 text-stone-700">
                  Buyers can also choose whether to include garments with alteration allowance. This helps surface pieces that may not fit perfectly as listed, but could work after tailoring. Sorting tools can then be used to browse by recommendation, price, or listing age.
                </p>
              </div>
            </details>

          </div>

          <div className="mt-8">
            <Link href="/marketplace" className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900">
              Back to Marketplace
            </Link>
          </div>
        </section>
      </PageWrap>
    </AppShell>
  );
}
