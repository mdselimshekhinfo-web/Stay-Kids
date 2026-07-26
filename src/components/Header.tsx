type HeaderProps = { menuOpen: boolean; setMenuOpen: (value: boolean) => void }

export default function Header({ menuOpen, setMenuOpen }: HeaderProps) {
  return (
    <header className="relative z-30 mx-auto flex max-w-[1440px] items-center justify-between px-6 py-6 lg:px-12">
      <a href="#top" className="flex items-center gap-2.5 font-bold tracking-[-0.04em] text-xl">
        <span className="grid h-8 w-8 place-items-center rounded-[11px] bg-[#1f775d] text-lg text-white">s</span>
        stay<span className="text-[#1f775d]">kids</span>
      </a>
      <nav className="hidden items-center gap-8 text-sm font-medium text-[#40504e] md:flex">
        <a className="transition hover:text-[#1f775d]" href="#features">Features</a>
        <a className="transition hover:text-[#1f775d]" href="#remote">Remote access</a>
        <a className="transition hover:text-[#1f775d]" href="#how">How it works</a>
        <a className="transition hover:text-[#1f775d]" href="#pricing">Pricing</a>
      </nav>
      <a href="#download" className="hidden rounded-full bg-[#172021] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1f775d] sm:block">Get StayKids</a>
      <button onClick={() => setMenuOpen(!menuOpen)} className="grid h-10 w-10 place-items-center rounded-full border border-[#d7ddd6] md:hidden" aria-label="Toggle menu"><span className="text-xl">{menuOpen ? "×" : "☰"}</span></button>
      {menuOpen && <div className="absolute right-6 top-18 flex w-52 flex-col gap-4 rounded-2xl border border-[#d7ddd6] bg-white p-5 shadow-xl md:hidden"><a href="#features">Features</a><a href="#remote">Remote access</a><a href="#how">How it works</a><a href="#pricing">Pricing</a></div>}
    </header>
  )
}
