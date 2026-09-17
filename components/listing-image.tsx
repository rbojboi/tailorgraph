import Image from "next/image";

type ListingImageProps = {
  src: string;
  alt: string;
  className?: string;
  sizes: string;
  loading?: "eager" | "lazy";
};

// Keep legacy external media working without making the optimizer an open proxy.
function canOptimize(src: string) {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname)
      && !url.port && !url.search && url.pathname.startsWith("/listings/");
  } catch { return false; }
}

export function ListingImage({ src, alt, className, sizes, loading = "lazy" }: ListingImageProps) {
  return <Image src={src} alt={alt} width={2400} height={2400} sizes={sizes}
    className={className} loading={loading} quality={85} unoptimized={!canOptimize(src)} />;
}
