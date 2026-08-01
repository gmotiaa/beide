import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconChevronDown,
  IconChevronUp,
  IconMessageCircleQuestion,
} from "@tabler/icons-react";
import { QuestionPrompt } from "./question-prompt";
import type { QuestionAnswer, QuestionConfig } from "./question-prompt";

export type QuestionToolPart = {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: {
    questions: QuestionConfig[];
    questionIndex?: number;
    totalQuestions?: number;
    onPreviousQuestion?: () => void;
    onNextQuestion?: () => void;
    submitLabel?: string;
    nextLabel?: string;
    skipLabel?: string;
    allowSkip?: boolean;
    onSubmitAnswer?: (answer: QuestionAnswer) => void;
  };
  output?: {
    answer?: QuestionAnswer;
  };
};

export type QuestionToolProps = {
  part: QuestionToolPart;
  chatStatus?: string;
};

function formatAnswer(
  answer: QuestionAnswer,
  t: (key: string) => string,
  labelFor?: (id: string) => string,
) {
  if (answer.kind === "skip") return t("agentElements.questionSkipped");
  if (answer.kind === "text")
    return answer.text || t("agentElements.questionAnswered");
  // Show option labels, not raw ids like "opt_1".
  const labels = answer.selectedIds?.length
    ? answer.selectedIds.map((id) => labelFor?.(id) ?? id).join(", ")
    : "";
  if (answer.text) return labels ? `${labels} (${answer.text})` : answer.text;
  return labels || t("agentElements.questionAnswered");
}

export function QuestionTool({ part }: QuestionToolProps) {
  const { t } = useTranslation();
  const [localIndex, setLocalIndex] = useState(part.input?.questionIndex ?? 1);
  const questions: QuestionConfig[] = part.input?.questions ?? [];
  const totalQuestions = part.input?.totalQuestions ?? questions.length;
  const isControlled = typeof part.input?.questionIndex === "number";
  const questionIndex = isControlled
    ? (part.input?.questionIndex ?? 1)
    : questions.length > 0
      ? localIndex
      : (part.input?.questionIndex ?? 1);
  const clampedIndex = Math.max(1, Math.min(questionIndex, totalQuestions));
  const question = questions[clampedIndex - 1];
  const [localAnswers, setLocalAnswers] = useState<
    Record<number, QuestionAnswer>
  >({});

  useEffect(() => {
    if (typeof part.input?.questionIndex === "number") {
      setLocalIndex(part.input.questionIndex);
    }
  }, [part.input?.questionIndex]);

  useEffect(() => {
    setLocalAnswers({});
    setLocalIndex(part.input?.questionIndex ?? 1);
  }, [part.toolCallId]);

  const outputAnswer = part.output?.answer;
  const answeredCount = Object.keys(localAnswers).length;
  const isComplete =
    totalQuestions === 1
      ? !!outputAnswer || answeredCount >= 1
      : totalQuestions > 0 && answeredCount >= totalQuestions;
  const showNavigation = totalQuestions > 1 && !isComplete;
  const canGoPrev = clampedIndex > 1;
  const canGoNext = clampedIndex < totalQuestions;
  const summaryAnswers = useMemo(() => {
    if (!isComplete || totalQuestions <= 1) return [];
    return Array.from({ length: totalQuestions }, (_, idx) => ({
      index: idx + 1,
      answer: localAnswers[idx + 1],
    }));
  }, [isComplete, localAnswers, totalQuestions]);
  const summaryText = useMemo(() => {
    if (!isComplete) return "";
    const labelForQuestion = (index: number) => (id: string) =>
      questions[index - 1]?.options?.find((o) => o.id === id)?.label ?? id;
    if (summaryAnswers.length > 0) {
      return summaryAnswers
        .map(
          (item) =>
            `${item.index}: ${
              item.answer
                ? formatAnswer(item.answer, t, labelForQuestion(item.index))
                : t("agentElements.questionPending")
            }`,
        )
        .join(" • ");
    }
    if (outputAnswer)
      return formatAnswer(outputAnswer, t, labelForQuestion(clampedIndex));
    if (localAnswers[clampedIndex])
      return formatAnswer(
        localAnswers[clampedIndex],
        t,
        labelForQuestion(clampedIndex),
      );
    return t("agentElements.questionPending");
  }, [
    isComplete,
    summaryAnswers,
    outputAnswer,
    localAnswers,
    clampedIndex,
    questions,
    t,
  ]);

  // After every hook: an early return above the useMemos changed the hook
  // count between renders and crashed React when the input filled in later.
  if (!question) return null;

  const goPrev = () => {
    if (!canGoPrev) return;
    part.input?.onPreviousQuestion?.();
    if (!isControlled) {
      setLocalIndex((prev) => Math.max(1, prev - 1));
    }
  };

  const goNext = () => {
    if (!canGoNext) return;
    part.input?.onNextQuestion?.();
    if (!isControlled) {
      setLocalIndex((prev) => Math.min(totalQuestions, prev + 1));
    }
  };

  return (
    <div className="rounded-an-tool-border-radius border border-border bg-an-tool-background overflow-hidden">
      <div className="h-7 border-b border-border px-3 flex items-center justify-between text-xs text-an-tool-color-muted">
        <div className="inline-flex items-center gap-1.5">
          <IconMessageCircleQuestion className="w-3.5 h-3.5" />
          {t("agentElements.question")}
        </div>
        {showNavigation && (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              className="size-5 inline-flex items-center justify-center rounded-[4px] hover:bg-an-background-secondary disabled:opacity-40"
              aria-label={t("agentElements.previousQuestion")}
            >
              <IconChevronUp className="w-3.5 h-3.5" />
            </button>
            <span>
              {t("agentElements.questionProgress", {
                current: clampedIndex,
                total: totalQuestions,
              })}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="size-5 inline-flex items-center justify-center rounded-[4px] hover:bg-an-background-secondary disabled:opacity-40"
              aria-label={t("agentElements.nextQuestion")}
            >
              <IconChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {isComplete ? (
        <div className="px-3 py-2 text-xs text-an-tool-color-muted bg-background">
          {summaryText}
        </div>
      ) : (
        <QuestionPrompt
          key={`${clampedIndex}-${question.title}`}
          questions={questions}
          questionIndex={clampedIndex}
          totalQuestions={totalQuestions}
          initialAnswer={localAnswers[clampedIndex]}
          submitLabel={part.input?.submitLabel}
          nextLabel={part.input?.nextLabel}
          skipLabel={part.input?.skipLabel}
          allowSkip={part.input?.allowSkip}
          onSubmit={(nextAnswer) => {
            setLocalAnswers((prev) => ({
              ...prev,
              [clampedIndex]: nextAnswer,
            }));
            part.input?.onSubmitAnswer?.(nextAnswer);
            if (clampedIndex < totalQuestions) {
              goNext();
            }
          }}
        />
      )}
    </div>
  );
}
