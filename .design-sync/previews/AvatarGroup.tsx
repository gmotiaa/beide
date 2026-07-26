import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "beide"

export function Stacked() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>GM</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>AI</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>OP</AvatarFallback>
      </Avatar>
    </AvatarGroup>
  )
}

export function WithCount() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>GM</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>AI</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>OP</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+7</AvatarGroupCount>
    </AvatarGroup>
  )
}

export function Sizes() {
  return (
    <div className="flex flex-col items-start gap-4">
      <AvatarGroup>
        <Avatar size="sm">
          <AvatarFallback>GM</AvatarFallback>
        </Avatar>
        <Avatar size="sm">
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>
      <AvatarGroup>
        <Avatar size="lg">
          <AvatarFallback>GM</AvatarFallback>
        </Avatar>
        <Avatar size="lg">
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>
    </div>
  )
}
