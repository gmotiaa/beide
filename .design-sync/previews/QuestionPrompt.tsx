import { QuestionPrompt } from "beide"

const noop = () => {}

const single = {
  kind: "single" as const,
  title: "Where should checkpoints live?",
  description: "This decides what a rollback can restore.",
  options: [
    {
      id: "workspace",
      label: "Inside the workspace",
      description: "A .beide/ directory next to the code — visible in git.",
    },
    {
      id: "appdata",
      label: "In app data",
      description: "Out of the repo, keyed by workspace path.",
    },
  ],
}

export function SingleChoice() {
  return (
    <div className="w-[28rem]">
      <QuestionPrompt questions={[single]} onSubmit={noop} />
    </div>
  )
}

export function MultiChoice() {
  return (
    <div className="w-[28rem]">
      <QuestionPrompt
        questions={[
          {
            kind: "multi",
            title: "Which panels open on launch?",
            options: [
              { id: "files", label: "File tree" },
              { id: "terminal", label: "Terminal" },
              { id: "agent", label: "Agent" },
            ],
            minSelections: 1,
          },
        ]}
        onSubmit={noop}
        allowSkip
      />
    </div>
  )
}

export function FreeText() {
  return (
    <div className="w-[28rem]">
      <QuestionPrompt
        questions={[
          {
            kind: "text",
            title: "What should the release note say?",
            placeholder: "One line, present tense…",
          },
        ]}
        onSubmit={noop}
      />
    </div>
  )
}

export function Paginated() {
  return (
    <div className="w-[28rem]">
      <QuestionPrompt
        questions={[single]}
        questionIndex={2}
        totalQuestions={3}
        onPreviousQuestion={noop}
        onNextQuestion={noop}
        onSubmit={noop}
      />
    </div>
  )
}
