import { LoaderCircle } from "lucide-react";

export function WorkspaceLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="panel-surface flex w-full max-w-md flex-col items-center rounded-[32px] px-8 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Opening TradEdge</h1>
        <p className="mt-2 text-sm leading-7 text-foreground/65">{label}</p>
      </div>
    </div>
  );
}
