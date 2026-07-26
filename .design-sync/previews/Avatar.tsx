import { Avatar, AvatarBadge, AvatarFallback } from "beide"
import { Check } from "lucide-react"

export function Sizes() {
  return (
    <div className="flex items-end gap-4">
      <Avatar size="sm">
        <AvatarFallback>GM</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>GM</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>GM</AvatarFallback>
      </Avatar>
    </div>
  )
}

export function Fallbacks() {
  return (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarFallback>AI</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>OP</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>ID</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-primary text-primary-foreground">
          B
        </AvatarFallback>
      </Avatar>
    </div>
  )
}

export function WithBadge() {
  return (
    <div className="flex items-end gap-4">
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
        <AvatarBadge>
          <Check />
        </AvatarBadge>
      </Avatar>
    </div>
  )
}
