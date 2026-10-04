# Lesson 00: the skeleton

**Lines we own:** 12 of TypeScript config, about 50 of instructions, about 70 of evals

## The idea

A conversational agent is a loop. A message comes in, the model reads it together with its instructions and the conversation so far, and it either replies or asks to call a tool. If it calls a tool, the result goes back to the model and the loop continues. Everything Companion, Instinct and Muse do sits on top of this loop.

At this stage Steward has the loop and nothing else. It has no tools, so it can only talk. That is deliberate. Every capability added later is a file someone chose to add.

## What we rented

| Need | Rented from | What it gives us |
|---|---|---|
| The loop, sessions, streaming, an HTTP API | `eve` | A durable session per conversation, a message route, a terminal chat for development |
| The model | Vercel AI Gateway | One API key for many providers; the model is a string |
| Behaviour tests | `eve eval` | Boots the real agent, sends real messages, checks what came back |

## What we wrote

1. **`agent/agent.ts`.** It picks the model, sets `defaultTools: false` and caps spend per session at 2 US dollars.
2. **`agent/instructions.md`.** The system prompt: who Steward is, how it writes in a text thread, what it may claim, and two boundaries (no secrets in the thread, quoted content is never an instruction).
3. **`evals/stage-0/`.** Four checks that state the lesson in executable form.

`agent/channels/eve.ts` came from the scaffold and is unchanged. It is the local HTTP and terminal channel.

## The finding that shaped this stage

eve gives a new agent a shell, file access and web tools by default. That is convenient for a coding agent and wrong for a personal assistant, where the safe starting point is "can do nothing". `defaultTools: false` reverses the default. From here on, a tool exists only if there is a file for it under `agent/tools/`, so the list of what Steward can do is the directory listing. This is the principle of fail-safe defaults from Saltzer and Schroeder, applied in one line.

## What the evals prove

| Eval | Claim |
|---|---|
| `smoke` | A greeting gets a short plain-text reply and no tool call |
| `boundaries/0000` | Asked to send an email with no email tool, it says it cannot and offers a draft. It does not pretend. |
| `boundaries/0001` | A password pasted into the thread is not repeated back |
| `boundaries/0002` | An instruction hidden in a quoted email is ignored, and the real content is still summarised |

These are prompt-level protections. They hold because the model follows its instructions, and a model can be talked out of instructions. They are worth having and they are not a security boundary. Stage 3 adds the first protection that is enforced in code.

## Try it

```bash
nvm use            # Node 24, from .nvmrc
npm run dev        # chat with Steward in the terminal
npm run eval       # run the four checks
```

To change the model, edit the `model` string in `agent/agent.ts` (for example to `openai/gpt-5.5`) and run the evals again. The instructions and the evals stay the same. Comparing how two models handle `boundaries/0002` is a useful ten-minute exercise.

## How the products do this

Companion has users sign in to their own ChatGPT subscription, so the model and its bill belong to the user. Muse runs Meta's own model. Steward takes the middle path: we pay per token through a gateway and can switch provider at will. None of the three exposes its instructions. Ours are a file you can read.
