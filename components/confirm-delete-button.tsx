"use client";

import type { ReactNode } from "react";

export function ConfirmDeleteButton({
  children,
  className,
  message
}: {
  children: ReactNode;
  className: string;
  message: string;
}) {
  return (
    <button
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
