import { IconButton, Icons } from "beide"

export function ActivityIcons() {
  return (
    <div className="flex items-center gap-1">
      <IconButton label="Files">{Icons.files}</IconButton>
      <IconButton label="Search">{Icons.search}</IconButton>
      <IconButton label="Source control">{Icons.sourceControl}</IconButton>
      <IconButton label="Terminal">{Icons.terminal}</IconButton>
      <IconButton label="Agent">{Icons.chat}</IconButton>
      <IconButton label="Settings">{Icons.settings}</IconButton>
    </div>
  )
}

export function States() {
  return (
    <div className="flex items-center gap-1">
      <IconButton label="Files">{Icons.files}</IconButton>
      <IconButton label="Search" active>
        {Icons.search}
      </IconButton>
      <IconButton label="Terminal" disabled>
        {Icons.terminal}
      </IconButton>
    </div>
  )
}

export function EditorActions() {
  return (
    <div className="flex items-center gap-1">
      <IconButton label="New file">{Icons.plus}</IconButton>
      <IconButton label="Attach image">{Icons.image}</IconButton>
      <IconButton label="Send">{Icons.send}</IconButton>
      <IconButton label="Stop">{Icons.stop}</IconButton>
      <IconButton label="Close">{Icons.close}</IconButton>
    </div>
  )
}
