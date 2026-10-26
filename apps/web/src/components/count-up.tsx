import { useEffect, useRef } from "react"
import { animate, useInView } from "motion/react"

/** Animated number that counts up when it enters view. */
export function CountUp({ value, digits = 0, format }: { value: number; digits?: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const shown = useRef(0)
  const fmt = format ?? ((n: number) => n.toLocaleString("fa-IR", { maximumFractionDigits: digits }))

  useEffect(() => {
    const node = ref.current
    if (!inView || !node) return
    const controls = animate(shown.current, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        shown.current = v
        node.textContent = fmt(digits ? v : Math.round(v))
      },
    })
    return () => controls.stop()
  }, [value, inView]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span ref={ref} className="num">
      {fmt(0)}
    </span>
  )
}
