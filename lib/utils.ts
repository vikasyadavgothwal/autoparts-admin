import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge tailwind class values into a single deduplicated class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
