export function TradEdgeLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f9688_0%,#0c675e_100%)] text-white shadow-[0_16px_30px_rgba(15,150,136,0.28)]">
        <span className="text-lg font-black tracking-[-0.08em]">TE</span>
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">TradEdge</p>
        <p className="text-xs uppercase tracking-[0.22em] text-foreground/48">
          Connected User
        </p>
      </div>
    </div>
  );
}
