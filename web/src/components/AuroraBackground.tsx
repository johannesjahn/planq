/**
 * The backdrop everything else is layered on.
 *
 * Glass only reads as glass when there is something worth blurring behind it, so
 * this renders three slowly drifting colour fields, a faint perspective grid and a
 * grain overlay. It is `fixed` and `aria-hidden` — purely decorative, and it must
 * not scroll away from under the panels that blur it.
 */
export function AuroraBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background grain">
      {/* Colour fields. Heavily blurred and oversized so their edges never enter frame.
          The `max(…)` floor keeps them large enough to fill a phone screen, where a
          plain viewport-width size would collapse into three small dots. */}
      <div className="absolute -top-[30%] -left-[15%] size-[max(70vw,560px)] animate-drift-slow rounded-full bg-iris/35 blur-[120px]" />
      <div className="absolute top-[10%] -right-[20%] size-[max(65vw,520px)] animate-drift-slower rounded-full bg-cyan/22 blur-[130px]" />
      <div className="absolute -bottom-[30%] left-[20%] size-[max(60vw,480px)] animate-drift-slow rounded-full bg-rose/22 blur-[140px] [animation-delay:-8s]" />

      {/* Perspective grid — gives the blur something structured to distort. */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 45%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 45%, black 20%, transparent 80%)"
        }}
      />

      {/* Vignette, so the centred content stays the brightest thing on screen. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--background)_100%)]" />
    </div>
  )
}
