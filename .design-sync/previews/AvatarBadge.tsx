import { Avatar, AvatarBadge, AvatarFallback } from "beide"
import { Check } from "lucide-react"

export function AcrossSizes() {
  return (
    <div className="flex items-end gap-5">
      <Avatar size="sm">
        <AvatarFallback>GM</AvatarFallback>
        <AvatarBadge />
      </Avatar>
      <Avatar>
        <AvatarFallback>GM</AvatarFallback>
        <AvatarBadge />
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>GM</AvatarFallback>
        <AvatarBadge />
      </Avatar>
    </div>
  )
}

export function WithIcon() {
  return (
    <div className="flex items-end gap-5">
      <Avatar>
        <AvatarFallback>GM</AvatarFallback>
        <AvatarBadge>
          <Check />
        </AvatarBadge>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>GM</AvatarFallback>
        <AvatarBadge>
          <Check />
        </AvatarBadge>
      </Avatar>
      <Avatar size="sm">
        <AvatarFallback>GM</AvatarFallback>
        <AvatarBadge>
          <Check />
        </AvatarBadge>
      </Avatar>
    </div>
  )
}

export function CustomColour() {
  return (
    <div className="flex items-end gap-5">
      <Avatar size="lg">
        <AvatarFallback>ID</AvatarFallback>
        <AvatarBadge className="bg-destructive" />
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>ID</AvatarFallback>
        <AvatarBadge className="bg-warning" />
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>ID</AvatarFallback>
        <AvatarBadge className="bg-muted-foreground" />
      </Avatar>
    </div>
  )
}
