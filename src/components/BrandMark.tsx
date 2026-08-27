import { BRAND } from "@/types";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <img src={BRAND.logoMark} alt="" width={512} height={512} loading="eager" />
    </span>
  );
}
