import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import type { ModelOption } from "../types";
import { cn } from "../utils/cn";
import { Popover } from "./popover";

export type ModelPickerProps = {
  models: ModelOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (modelId: string) => void;
  placeholder?: string;
  className?: string;
};

export const ModelPicker = memo(function ModelPicker({
  models,
  value,
  defaultValue,
  onChange,
  placeholder,
  className,
}: ModelPickerProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("agentElements.modelAuto");
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeId = isControlled ? value : internalValue;
  const activeModel = models.find((m) => m.id === activeId) ?? models[0];
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (id: string) => {
      if (!isControlled) setInternalValue(id);
      onChange?.(id);
      setOpen(false);
    },
    [isControlled, onChange],
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="top"
      align="start"
      className="w-56 p-0 overflow-hidden"
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] leading-4 text-foreground/40 transition-colors hover:bg-foreground/6 cursor-pointer",
            className,
          )}
          aria-label={t("agentElements.selectModel")}
        >
          <span className="font-medium">
            {activeModel?.name ?? resolvedPlaceholder}
          </span>
          {activeModel?.version && (
            <span className="font-normal text-foreground/25">
              {activeModel.version}
            </span>
          )}
          <IconChevronDown className="size-3 text-foreground/40" />
        </button>
      }
    >
      {/* 19 models × 9 groups outgrow the screen as a plain popup — cap the
          height to the viewport and scroll inside instead. */}
      <div className="max-h-[min(340px,55vh)] overflow-y-auto overscroll-contain p-1">
        {models.map((model, index) => {
          const isActive = model.id === activeModel?.id;
          const groupStart =
            model.group && model.group !== models[index - 1]?.group;
          return (
            <div key={model.id}>
              {groupStart && (
                <div
                  className={cn(
                    "px-2 pb-px pt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground/30 select-none",
                    index > 0 && "mt-0.5",
                  )}
                >
                  {model.group}
                </div>
              )}
              <button
                type="button"
                disabled={model.disabled}
                title={model.disabled ? t("agentElements.modelUnavailable") : undefined}
                onClick={model.disabled ? undefined : () => handleSelect(model.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[6px] px-2 py-1 text-left text-[12px] leading-4 text-an-foreground transition-colors",
                  model.disabled
                    ? "cursor-not-allowed text-foreground/25"
                    : "hover:bg-foreground/6 cursor-pointer",
                  isActive && "bg-foreground/6",
                )}
              >
                <span className="flex-1 truncate">
                  {model.name}
                  {model.version && (
                    <span
                      className={cn(
                        "ml-1",
                        model.disabled ? "text-foreground/20" : "text-foreground/40",
                      )}
                    >
                      {model.version}
                    </span>
                  )}
                </span>
                {isActive && (
                  <IconCheck className="size-3.5 shrink-0 text-foreground/60" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </Popover>
  );
});

export type ModelBadgeProps = {
  models: ModelOption[];
  value?: string;
  placeholder?: string;
  className?: string;
};

export const ModelBadge = memo(function ModelBadge({
  models,
  value,
  placeholder,
  className,
}: ModelBadgeProps) {
  const { t } = useTranslation();
  const activeModel = models.find((m) => m.id === value) ?? models[0];
  return (
    <div
      className={cn(
        "inline-flex h-7 items-center px-2 text-[12px] leading-4 text-foreground/30",
        className,
      )}
    >
      <span className="font-medium">
        {activeModel?.name ?? placeholder ?? t("agentElements.modelAuto")}
      </span>
      {activeModel?.version && (
        <span className="ml-0.5 font-normal text-foreground/20">
          {activeModel.version}
        </span>
      )}
    </div>
  );
});
