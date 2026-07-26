import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "./utils/cn";

export type ErrorMessageProps = {
  title?: string;
  message: string;
  className?: string;
};

export const ErrorMessage = memo(function ErrorMessage({
  title,
  message,
  className,
}: ErrorMessageProps) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex justify-start", className)}>
      <div className="border border-[color:var(--danger)]/30 bg-[color:var(--danger-muted)] px-4 py-2.5 text-sm text-an-foreground rounded-[8px]">
        <div className="font-medium text-an-foreground">
          {title ?? t("agentElements.somethingWentWrong")}
        </div>
        <div className="mt-0.5 text-an-foreground-muted">{message}</div>
      </div>
    </div>
  );
});
