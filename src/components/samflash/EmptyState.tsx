import type { ElementType, ReactNode } from "react";

/** Message affiché quand une liste est vide (au lieu d'une zone blanche). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card/30 px-6 py-12 text-center backdrop-blur-xl">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-[15px] font-semibold">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
