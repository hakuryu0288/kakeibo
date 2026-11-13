'use client'

// 金額をタップで足していくボタン（+1〜+10,000、クリア）
const STEPS = [1, 10, 100, 1000, 10000]

export default function AmountSteps({
  onAdd,
  onClear,
  compact = false,
}: {
  onAdd: (n: number) => void
  onClear: () => void
  compact?: boolean
}) {
  const size = compact ? 'py-1.5 text-[11px]' : 'py-2 text-xs'
  return (
    <div className="grid grid-cols-6 gap-1">
      {STEPS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onAdd(n)}
          className={`${size} rounded-lg bg-slate-100 text-slate-700 font-medium active:bg-indigo-100 active:scale-95 transition-transform select-none`}
        >
          +{n.toLocaleString('ja-JP')}
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className={`${size} rounded-lg bg-red-50 text-red-500 font-medium active:scale-95 transition-transform select-none`}
      >
        クリア
      </button>
    </div>
  )
}

// 文字列の金額に足す（空や不正な値は0として扱う）
export function addAmount(current: string, n: number): string {
  return String((parseInt(current) || 0) + n)
}
