import { Skeleton } from "beide"

export function Shapes() {
  return (
    <div className="flex w-72 flex-col gap-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-8 flex-1 rounded-lg" />
      </div>
    </div>
  )
}

export function MessagePlaceholder() {
  return (
    <div className="flex w-80 gap-3">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  )
}

export function FileListPlaceholder() {
  return (
    <div className="flex w-64 flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton
            className="h-3"
            style={{ width: `${[70, 55, 80, 45, 65][i]}%` }}
          />
        </div>
      ))}
    </div>
  )
}
