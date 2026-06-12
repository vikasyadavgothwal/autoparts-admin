import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type {
  DashboardSelectProps,
  GaragesFiltersProps,
  NormalizeOption,
  OptionItemProps,
} from "@/types/admin-dashboard/garages/garages-filters"

export function GaragesFilters({
  statusOptions,
  locationOptions,
  verificationOptions,
}: GaragesFiltersProps) {
  return (
    <div className="dashboard-filter-bar">
      <DashboardSelect placeholder={statusOptions[0] ?? "All Status"}>
        {statusOptions.map((value) => (
          <OptionItem key={value} value={normalizeOption(value)} label={value} />
        ))}
      </DashboardSelect>

      <DashboardSelect placeholder={locationOptions[0] ?? "All Locations"}>
        {locationOptions.map((value) => (
          <OptionItem key={value} value={normalizeOption(value)} label={value} />
        ))}
      </DashboardSelect>

      <DashboardSelect placeholder={verificationOptions[0] ?? "Verification Status"}>
        {verificationOptions.map((value) => (
          <OptionItem key={value} value={normalizeOption(value)} label={value} />
        ))}
      </DashboardSelect>
    </div>
  )
}

function DashboardSelect({ placeholder, children }: DashboardSelectProps) {
  return (
    <Select>
      <SelectTrigger className="dashboard-filter-control w-full md:w-[210px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-dashboard-panel-border bg-dashboard-panel-bg text-dashboard-text">
        {children}
      </SelectContent>
    </Select>
  )
}

function OptionItem({ value, label }: OptionItemProps) {
  return (
    <SelectItem
      value={value}
      className="focus:bg-dashboard-surface-hover focus:text-dashboard-text"
    >
      {label}
    </SelectItem>
  )
}

const normalizeOption: NormalizeOption = (value) => {
  return value.toLowerCase().replace(/\s+/g, "-")
}
