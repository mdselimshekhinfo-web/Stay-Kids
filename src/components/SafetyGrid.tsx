const features = [
  ["◔", "Healthy screen habits", "Create calm routines with schedules, app limits, and intentional breaks.", "bg-[#f1e5cd]"],
  ["⌖", "Know they got there", "Gentle location updates and safe-zone alerts keep the day in view.", "bg-[#d9edce]"],
  ["◌", "Make online safer", "Spot concerning activity and guide them toward better digital choices.", "bg-[#dce9ec]"],
]
export default function SafetyGrid() {
  return <section id="features" className="border-y border-[#dfe3dc] bg-white py-24"><div className="mx-auto max-w-[1440px] px-6 lg:px-12"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#1f775d]">Everyday peace of mind</p><h2 className="mt-4 font-display text-5xl leading-[.95] tracking-[-.055em] sm:text-6xl">The guardrails they need. The trust they deserve.</h2></div><div className="mt-14 grid gap-4 md:grid-cols-3">{features.map(([icon, title, text, bg]) => <article key={title} className="group rounded-[28px] border border-[#e2e6df] bg-[#fcfcfa] p-7 transition hover:-translate-y-1 hover:shadow-xl"><div className={`grid h-14 w-14 place-items-center rounded-2xl text-3xl ${bg}`}>{icon}</div><h3 className="mt-12 text-xl font-bold tracking-tight">{title}</h3><p className="mt-3 leading-7 text-[#66736f]">{text}</p><a href="#how" className="mt-7 inline-block text-sm font-bold text-[#1f775d]">Learn more <span className="transition group-hover:ml-1">→</span></a></article>)}</div></div></section>
}
