import {
  useId,
  useState,
  type ChangeEvent,
  type ComponentProps,
} from "react"
import { Input } from "@/components/ui/input"

type LimitedInputProps = ComponentProps<"input"> & {
  maxLength: number
  showCount?: boolean
  counterLabel?: string
}

function LimitedInput({
  maxLength,
  showCount = true,
  className,
  value,
  defaultValue,
  onChange,
  counterLabel,
  ...props
}: LimitedInputProps) {
  const isControlled = value !== undefined
  const [inputValue, setInputValue] = useState(() =>
    String(value ?? defaultValue ?? "").slice(0, maxLength)
  )
  const counterId = useId()

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.slice(0, maxLength)

    if (event.target.value !== nextValue) {
      event.target.value = nextValue
    }

    if (!isControlled) {
      setInputValue(nextValue)
    }

    onChange?.(event)
  }

  const displayedValue = String(isControlled ? (value ?? "") : inputValue).slice(
    0,
    maxLength,
  )
  const length = displayedValue.length
  const countPrefix = counterLabel ? `${counterLabel} ` : ""

  return (
    <div className="space-y-1">
      <Input
        {...props}
        value={isControlled ? displayedValue : inputValue}
        defaultValue={isControlled ? undefined : defaultValue}
        maxLength={maxLength}
        onChange={handleChange}
        aria-describedby={showCount ? `${counterId}-counter` : undefined}
        className={className}
      />

      {showCount && (
        <p id={`${counterId}-counter`} className="text-right text-xs text-[#9CA3AF]">
          {countPrefix}
          {length}/{maxLength}
        </p>
      )}
    </div>
  )
}

export { LimitedInput }
