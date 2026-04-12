"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const slides = [
  {
    src: "/style-image-1.jpeg",
    alt: "Black and white menswear editorial portrait",
    objectPosition: "center center"
  },
  {
    src: "/style-image-2-new.jpeg",
    alt: "Black and white menswear street portrait",
    objectPosition: "center 36%"
  },
  {
    src: "/style-image-3.jpg",
    alt: "Black and white tailoring shop window scene",
    objectPosition: "center center"
  },
  {
    src: "/style-image-4.jpg",
    alt: "Black and white tailored coat portrait",
    objectPosition: "center center"
  },
  {
    src: "/style-image-5.jpg",
    alt: "Black and white formal tailoring portrait",
    objectPosition: "center center"
  }
];

const ROTATION_MS = 4500;

export function HeroSlideshow({
  className = "",
  fillContainer = false,
  softEdges = true
}: {
  className?: string;
  fillContainer?: boolean;
  softEdges?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const mediaStyle = softEdges
    ? {
        WebkitMaskImage:
          "radial-gradient(circle at center, black 74%, transparent 100%), linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
        WebkitMaskComposite: "source-in",
        maskImage:
          "radial-gradient(circle at center, black 74%, transparent 100%), linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
        maskComposite: "intersect"
      }
    : undefined;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, ROTATION_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={`${fillContainer ? "" : "relative"} bg-transparent ${className}`.trim()}>
      <div
        className={fillContainer ? "absolute inset-0 overflow-hidden" : "relative aspect-[8/4.65] w-full overflow-hidden"}
        style={mediaStyle}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.src}
            className={`absolute inset-0 transition-opacity duration-700 ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={index === activeIndex ? undefined : true}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={index === 0}
              className="object-cover"
              style={{ objectPosition: slide.objectPosition }}
              quality={95}
              sizes="(min-width: 1280px) 1280px, 100vw"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
