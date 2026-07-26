const Check = () => <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m4 10 4 4 8-8" /></svg>

export default function Hero() {
  return (
    <section id="top" className="relative mx-auto grid max-w-[1440px] gap-12 px-6 pb-20 pt-10 lg:grid-cols-[.95fr_1.05fr] lg:items-center lg:px-12 lg:pb-28 lg:pt-20">
      <div className="relative z-10 max-w-xl">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#c8d8c9] bg-[#edf6e7] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.13em] text-[#1f775d]"><span className="h-2 w-2 rounded-full bg-[#7ccf3d]" /> Made for modern families</p>
        <h1 className="font-display text-[clamp(3.5rem,7vw,6.5rem)] leading-[.91] tracking-[-.065em] text-[#172021]">A little more <em className="text-[#1f775d]">there,</em> when they need you.</h1>
        <p className="mt-7 max-w-md text-lg leading-8 text-[#53615f]">StayKids helps you guide screen time, protect their digital world, and safely lend a hand from wherever you are.</p>
        <div className="mt-8 flex flex-wrap gap-3"><a id="download" href="#pricing" className="rounded-full bg-[#1f775d] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(31,119,93,.23)] transition hover:-translate-y-0.5">Start protecting</a><a href="#features" className="rounded-full border border-[#bdc9c2] bg-white px-6 py-3.5 text-sm font-bold text-[#172021] transition hover:border-[#1f775d]">Explore features <span aria-hidden="true">→</span></a></div>
        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#53615f]"><span className="flex items-center gap-1.5"><Check /> 7-day free trial</span><span className="flex items-center gap-1.5"><Check /> No card required</span></div>
      </div>
      <div className="relative mx-auto w-full max-w-[620px]">
        <div className="absolute -right-10 top-2 h-52 w-52 rounded-full bg-[#d8efad] blur-3xl" />
        <div className="relative min-h-[500px] overflow-hidden rounded-[38px] bg-[#1f775d] p-6 shadow-[0_25px_70px_rgba(24,48,40,.22)] sm:p-9">
          <div className="absolute -right-10 -top-12 h-64 w-64 rounded-full border-[28px] border-[#73bd55]" />
          <div className="absolute bottom-0 left-0 h-48 w-48 rounded-tr-full bg-[#f4d584]" />
          <div className="relative mx-auto max-w-[330px] rounded-[30px] border-[7px] border-[#172021] bg-[#fcfcf8] p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e5de] pb-3 text-[10px] font-bold"><span>9:41</span><span>● ● ●</span></div>
            <div className="pt-5"><p className="text-xs font-medium text-[#84908c]">Good afternoon</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Mia's day</h2></div>
            <div className="mt-5 rounded-2xl bg-[#edf6e7] p-4"><div className="flex justify-between text-xs"><span className="font-bold">Screen time</span><span className="text-[#1f775d]">1h 42m</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#d5e4cf]"><div className="h-full w-[58%] rounded-full bg-[#1f775d]" /></div><p className="mt-2 text-[10px] text-[#70817c]">58% of today's allowance</p></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-[#e1e5df] p-3"><span className="text-base">⌖</span><p className="mt-2 text-[11px] font-bold">At school</p><p className="text-[10px] text-[#7c8985]">Updated now</p></div><div className="rounded-2xl bg-[#172021] p-3 text-white"><span className="text-base">↗</span><p className="mt-2 text-[11px] font-bold">Need help?</p><p className="text-[10px] text-[#c4d1c8]">Ask parent</p></div></div>
          </div>
          <div className="absolute bottom-7 left-7 rounded-2xl bg-white px-4 py-3 shadow-xl"><p className="text-[10px] font-bold uppercase tracking-wider text-[#7d8883]">Live location</p><p className="mt-0.5 text-sm font-bold">Mia arrived safely <span className="text-[#1f775d]">✓</span></p></div>
        </div>
      </div>
    </section>
  )
}
