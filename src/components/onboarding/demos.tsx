import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  IconCheck,
  IconFileCode,
  IconSearch,
  IconSparkles,
} from "@tabler/icons-react";
import { cn } from "../../lib/utils";

/* Animated product "recordings" for the onboarding showcase. The whole
   choreography is CSS (see the demo section of onboarding.css): every element
   stays in normal flow and only toggles opacity/transform on one shared loop,
   so nothing ever reflows mid-scene — and with prefers-reduced-motion the
   keyframes drop away and the finished storyboard is simply shown static. */

function DemoWindow({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  // Decorative for AT: the showcase caption next to the stage carries the
  // meaning; the animation itself is eye candy.
  return (
    <div className={cn("demo-window", className)} aria-hidden>
      <div className="demo-window__bar">
        <span className="demo-window__dots">
          <i />
          <i />
          <i />
        </span>
        <span className="demo-window__title">{title}</span>
      </div>
      <div className="demo-window__body">{children}</div>
    </div>
  );
}

export function ChatDemo() {
  const { t } = useTranslation();
  return (
    <DemoWindow title="chat" className="demo-chat">
      <div className="demo-chat__user">
        <span className="demo-chat__usertext">
          {t("onboarding.demoChatUserMsg")}
        </span>
      </div>
      <div className="demo-chat__mention">
        <div className="demo-chat__mention-row is-pick">
          <IconFileCode className="size-3.5" stroke={1.75} />
          auth.ts
        </div>
        <div className="demo-chat__mention-row">
          <IconFileCode className="size-3.5" stroke={1.75} />
          api.ts
        </div>
        <div className="demo-chat__mention-row">
          <IconSearch className="size-3.5" stroke={1.75} />
          {t("onboarding.demoMentionSearch")}
        </div>
      </div>
      <div className="demo-chat__agent">
        <span className="demo-chat__agenttext">
          {t("onboarding.demoChatReply")}
        </span>
        <span className="demo-chat__chip">
          <IconCheck className="size-3" stroke={2.5} />
          {t("onboarding.demoChatChip")}
        </span>
      </div>
    </DemoWindow>
  );
}

export function InlineEditDemo() {
  const { t } = useTranslation();
  return (
    <DemoWindow title="auth.ts" className="demo-edit">
      <div className="demo-edit__code">
        <div className="demo-edit__line">
          <i>1</i>
          <span>
            <b>function</b> getUser(id) {"{"}
          </span>
        </div>
        <div className="demo-edit__line">
          <i>2</i>
          <span>
            {"  "}
            <b>const</b> user = cache.get(id)
          </span>
        </div>
        <div className="demo-edit__line demo-edit__line--sel">
          <i>3</i>
          <span className="demo-edit__swap">
            <span className="demo-edit__old">
              {"  "}
              <b>return</b> user.profile
            </span>
            <span className="demo-edit__new">
              {"  "}
              <b>return</b> user?.profile ?? <u>null</u>
            </span>
          </span>
        </div>
        <div className="demo-edit__line">
          <i>4</i>
          <span>{"}"}</span>
        </div>
      </div>
      <div className="demo-edit__kbar">
        <kbd>Ctrl</kbd>
        <kbd>K</kbd>
        <span className="demo-edit__prompt">
          {t("onboarding.demoEditPrompt")}
        </span>
      </div>
      <span className="demo-edit__applied">
        <IconCheck className="size-3" stroke={2.5} />
        {t("onboarding.demoEditApplied")}
      </span>
    </DemoWindow>
  );
}

export function TerminalDemo() {
  const { t } = useTranslation();
  return (
    <DemoWindow title="terminal" className="demo-term">
      <div className="demo-term__screen">
        <div className="demo-term__cmd">
          <em>$</em> <span className="demo-term__cmdtext">npm test</span>
        </div>
        <div className="demo-term__out demo-term__out--1">
          PASS src/models.test.ts
        </div>
        <div className="demo-term__swap">
          <span className="demo-term__fail">
            FAIL src/auth.test.ts — token refresh
          </span>
          <span className="demo-term__pass">PASS src/auth.test.ts</span>
        </div>
        <div className="demo-term__fix">
          <IconSparkles className="size-3.5" stroke={1.75} />
          {t("onboarding.demoTermFix")}
        </div>
        <div className="demo-term__sum">✓ 12 passed</div>
      </div>
    </DemoWindow>
  );
}
