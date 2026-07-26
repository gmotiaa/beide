import { Button, Spinner } from "beide";
import { ArrowRight, Check, Plus, Settings2, Trash2 } from "lucide-react";

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2">{children}</div>
);

export function Variants() {
  return (
    <div className="flex flex-col gap-2">
      <Row>
        <Button>Run</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
      </Row>
      <Row>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="link">Documentation</Button>
      </Row>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-col gap-2">
      <Row>
        <Button size="xs">Extra small</Button>
        <Button size="sm">Small</Button>
      </Row>
      <Row>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
      </Row>
    </div>
  );
}

export function WithIcons() {
  return (
    <div className="flex flex-col gap-2">
      <Row>
        <Button>
          <Plus />
          New file
        </Button>
        <Button variant="outline">
          Continue
          <ArrowRight />
        </Button>
      </Row>
      <Row>
        <Button variant="destructive">
          <Trash2 />
          Discard
        </Button>
        <Button variant="secondary" size="sm">
          <Check />
          Accept
        </Button>
      </Row>
    </div>
  );
}

export function IconOnly() {
  return (
    <Row>
      <Button size="icon-xs" variant="ghost" aria-label="Settings">
        <Settings2 />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Settings">
        <Settings2 />
      </Button>
      <Button size="icon" variant="outline" aria-label="Settings">
        <Settings2 />
      </Button>
      <Button size="icon-lg" aria-label="Add">
        <Plus />
      </Button>
    </Row>
  );
}

export function States() {
  return (
    <div className="flex flex-col gap-2">
      <Row>
        <Button disabled>Disabled</Button>
        <Button variant="outline" disabled>
          Disabled
        </Button>
      </Row>
      <Row>
        <Button variant="outline" aria-invalid>
          Invalid
        </Button>
        <Button variant="secondary" disabled>
          <Spinner size="sm" />
          Working…
        </Button>
      </Row>
    </div>
  );
}
