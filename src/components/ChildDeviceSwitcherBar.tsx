
import type { ChildDeviceInfo } from "../lib/staykids-api"

export function ChildDeviceSwitcherBar({
  childrenList,
  activeChildId,
  onSelectChild,
  onAddChild,
}: {
  childrenList: ChildDeviceInfo[]
  activeChildId: string
  onSelectChild: (childId: string) => void
  onAddChild: () => void
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 scrollbar-none">
      {childrenList.map((c) => {
        const isActive = c.id === activeChildId
        return (
          <button
            key={c.id}
            onClick={() => onSelectChild(c.id)}
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition shrink-0 ${
              isActive
                ? "bg-[#1d5946] text-white shadow-md ring-2 ring-[#287555]"
                : "bg-white text-[#586770] border border-[#e0e8e4] hover:bg-[#f0f5f2]"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${c.online ? "bg-[#43a878]" : "bg-[#9e9e9e]"}`} />
            <span>{c.name}</span>
            <span className="text-[10px] opacity-75 font-normal">({c.device})</span>
          </button>
        )
      })}

      <button
        onClick={onAddChild}
        className="flex items-center gap-1.5 rounded-2xl border border-dashed border-[#287555] bg-[#f3faee] px-3.5 py-2 text-xs font-bold text-[#287555] hover:bg-[#e6f4df] transition shrink-0"
      >
        <span>➕</span>
        <span>Add Child Device</span>
      </button>
    </div>
  )
}
