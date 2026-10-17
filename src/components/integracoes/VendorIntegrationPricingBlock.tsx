import {
  VENDOR_PRICING_CONSULTED_LABEL,
  VENDOR_PRICING_DISCLAIMER,
  type VendorPricingEntry,
} from "@/lib/vendor-integration-pricing";

type Props = {
  vendor: VendorPricingEntry;
};

export function VendorIntegrationPricingBlock({ vendor }: Props) {
  return (
    <div className="rounded-md border border-muted bg-muted/30 p-3 text-sm">
      <p className="font-medium text-foreground">Quanto custa</p>
      <p className="mt-1 text-muted-foreground">{vendor.priceSummary}</p>
      {vendor.priceDetail && (
        <p className="text-muted-foreground">{vendor.priceDetail}</p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Consulta de preços: {VENDOR_PRICING_CONSULTED_LABEL}.
      </p>
      <a
        href={vendor.officialPricingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Ver preços oficiais
      </a>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {VENDOR_PRICING_DISCLAIMER}
      </p>
    </div>
  );
}
