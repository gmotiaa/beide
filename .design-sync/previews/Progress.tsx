import { Progress, ProgressLabel, ProgressValue } from "beide"

export function Steps() {
  return (
    <div className="flex w-72 flex-col gap-5">
      <Progress value={0} />
      <Progress value={35} />
      <Progress value={70} />
      <Progress value={100} />
    </div>
  )
}

export function WithLabelAndValue() {
  return (
    <div className="flex w-72 flex-col gap-6">
      <Progress value={62}>
        <ProgressLabel>Context used</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={18}>
        <ProgressLabel>Upload</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  )
}

export function Indeterminate() {
  return (
    <div className="flex w-72 flex-col gap-6">
      <Progress value={null}>
        <ProgressLabel>Indexing workspace</ProgressLabel>
      </Progress>
    </div>
  )
}
