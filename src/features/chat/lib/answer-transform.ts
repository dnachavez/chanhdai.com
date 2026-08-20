import type { TextStreamPart, ToolSet } from "ai"

import { CHAT_COPY } from "../config"
import { createCallSyntaxSuppressor } from "./suppress-call-syntax"

/**
 * Guarantees the visitor gets exactly one thing: an answer, or a sentence saying
 * there is not one. Never nothing, and never the model's plumbing.
 *
 * Two failures this sits on, both found by a generated scan against the shipped
 * model and neither visible to the regression suite, whose `[[EMPTY]]` assertions
 * only cover eleven fixed payloads:
 *
 * - A stream that reaches `finish` having emitted no text at all. The route hands
 *   the final step no tools so it has nothing to spend itself on, but a model can
 *   still put its whole output budget into reasoning and return an empty content
 *   channel. No prompt wording fixes that.
 * - A model denied its tools writing the call it wanted as plain text, which
 *   reaches the bubble verbatim. `createCallSyntaxSuppressor` drops it, and a
 *   turn that was nothing but call syntax then falls through to the same
 *   fallback line as an empty one.
 *
 * The fallback is enqueued ahead of the `finish` part so it belongs to the same
 * message rather than arriving as a second one, and is skipped when the stream
 * already carries an error — the client renders those itself and should not have
 * an answer stapled underneath.
 */
export function createAnswerTransform<TOOLS extends ToolSet>() {
  const suppressor = createCallSyntaxSuppressor()
  let sawText = false
  let sawError = false

  return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
    transform(part, controller) {
      if (part.type === "error") sawError = true

      if (part.type === "text-delta") {
        const visible = suppressor.push(part.text)
        if (visible === "") return
        if (visible.trim() !== "") sawText = true
        controller.enqueue({ ...part, text: visible })
        return
      }

      if (part.type === "finish") {
        const tail = suppressor.flush()
        if (tail !== "") {
          if (tail.trim() !== "") sawText = true
          controller.enqueue({ type: "text-delta", id: "tail", text: tail })
        }

        if (!sawText && !sawError) {
          const id = "empty-fallback"
          controller.enqueue({ type: "text-start", id })
          controller.enqueue({ type: "text-delta", id, text: CHAT_COPY.empty })
          controller.enqueue({ type: "text-end", id })
        }
      }

      controller.enqueue(part)
    },
  })
}
