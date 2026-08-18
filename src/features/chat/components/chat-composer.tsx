"use client"

import { useRef } from "react"
import { ArrowUpIcon, SquareIcon } from "lucide-react"

import { Button } from "@/components/base/ui/button"

import { CHAT_COPY, MAX_MESSAGE_LENGTH } from "../config"
import { htmlToMarkdown } from "../lib/html-to-markdown"

/**
 * Markdown source with the shortcuts people expect from a rich editor.
 *
 * Still a `<textarea>`, deliberately. The alternative — a contenteditable that
 * renders bold as bold while typing — means owning IME composition, mobile
 * keyboards, undo history and caret behaviour, all of which the platform gets
 * right here for free. Instead `cmd+B` wraps the selection in `**`, pasted rich
 * text is converted to markdown, and the bubble renders the result. The visitor
 * sees bold text either way; the difference is whether they see it before or
 * after sending.
 */

const WRAPPERS = {
  b: { before: "**", after: "**" },
  i: { before: "_", after: "_" },
  e: { before: "`", after: "`" },
} as const

type Selection = { value: string; start: number; end: number }

/**
 * Toggles a wrapper around the selection, or inserts an empty pair with the
 * caret between the delimiters when nothing is selected.
 */
export function toggleWrapper(
  { value, start, end }: Selection,
  { before, after }: { before: string; after: string }
) {
  const selected = value.slice(start, end)

  const alreadyWrapped =
    value.slice(start - before.length, start) === before &&
    value.slice(end, end + after.length) === after

  if (alreadyWrapped) {
    return {
      value:
        value.slice(0, start - before.length) +
        selected +
        value.slice(end + after.length),
      start: start - before.length,
      end: end - before.length,
    }
  }

  // Trailing spaces inside the delimiters produce literal asterisks rather than
  // emphasis, so a selection made by double-clicking a word still works.
  const leading = selected.length - selected.trimStart().length
  const trailing = selected.length - selected.trimEnd().length
  const core = selected.slice(leading, selected.length - trailing)

  const wrapped =
    selected.slice(0, leading) +
    before +
    core +
    after +
    selected.slice(selected.length - trailing)

  return {
    value: value.slice(0, start) + wrapped + value.slice(end),
    start: start + leading + before.length,
    end: start + leading + before.length + core.length,
  }
}

/** `cmd+K` over a selection makes it the link text, not the URL. */
export function insertLink({ value, start, end }: Selection) {
  const selected = value.slice(start, end)
  const inserted = `[${selected}](url)`

  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    // Select the placeholder so typing replaces it.
    start: start + selected.length + 3,
    end: start + selected.length + 6,
  }
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isBusy,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
  isBusy: boolean
  disabled: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  /**
   * Applied straight to the DOM node before the controlled update, so the caret
   * and selection land where the shortcut intends. Setting state alone would
   * re-render with the caret at the end of the field.
   */
  const apply = (next: { value: string; start: number; end: number }) => {
    const textarea = ref.current
    if (!textarea) return

    onChange(next.value)

    // After the value prop lands, not before, or the browser clamps the range to
    // the old length.
    requestAnimationFrame(() => {
      textarea.setSelectionRange(next.start, next.end)
      textarea.focus()
    })
  }

  const selectionOf = (textarea: HTMLTextAreaElement): Selection => ({
    value: textarea.value,
    start: textarea.selectionStart,
    end: textarea.selectionEnd,
  })

  return (
    <form
      className="screen-line-top flex items-end gap-2 p-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label className="sr-only" htmlFor="chat-input">
        {CHAT_COPY.placeholder}
      </label>

      <textarea
        ref={ref}
        id="chat-input"
        rows={1}
        value={value}
        disabled={disabled}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder={CHAT_COPY.placeholder}
        className="field-sizing-content max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
        onChange={(event) => onChange(event.target.value)}
        onPaste={(event) => {
          const html = event.clipboardData.getData("text/html")
          if (!html) return

          const markdown = htmlToMarkdown(html)
          if (!markdown) return

          event.preventDefault()

          const {
            value: current,
            start,
            end,
          } = selectionOf(event.currentTarget)
          apply({
            value: current.slice(0, start) + markdown + current.slice(end),
            start: start + markdown.length,
            end: start + markdown.length,
          })
        }}
        onKeyDown={(event) => {
          const modifier = event.metaKey || event.ctrlKey

          if (modifier && !event.altKey) {
            const key = event.key.toLowerCase()

            if (key in WRAPPERS) {
              event.preventDefault()
              apply(
                toggleWrapper(
                  selectionOf(event.currentTarget),
                  WRAPPERS[key as keyof typeof WRAPPERS]
                )
              )
              return
            }

            if (key === "k") {
              event.preventDefault()
              apply(insertLink(selectionOf(event.currentTarget)))
              return
            }
          }

          // Enter sends; Shift+Enter is a newline. Left alone while an IME is
          // composing, where Enter commits the candidate rather than the message.
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault()
            onSubmit()
          }
        }}
      />

      {isBusy ? (
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Stop generating"
          onClick={onStop}
        >
          <SquareIcon />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon-sm"
          aria-label="Send message"
          disabled={!value.trim() || disabled}
        >
          <ArrowUpIcon />
        </Button>
      )}
    </form>
  )
}
