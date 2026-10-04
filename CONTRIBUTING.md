# Contributing to Steward

Steward exists to teach how a text-message assistant is put together. Contributions that make it clearer, safer or easier to follow are welcome. Contributions that make it bigger need a strong reason: the code budget is part of the lesson.

## Before you open a pull request

1. Run `npm run check`. It runs the typecheck, the unit tests and the public-tree scan, and it must pass.
2. If you changed behaviour, run the evals with your own model key: `npm run eval`.
3. Sign off every commit (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/).

## Rules for the code

- **Every tool goes through the Gatekeeper.** A new file in `agent/tools/` needs `approval: gate("<name>")`, `execute: withReceipt("<name>", ...)` and an entry in `agent/lib/policy.ts`. A unit test fails otherwise.
- **New logic gets a failing test first.** Behaviour that depends on the model gets an eval.
- **No secrets in code.** Credentials stay in a token broker or in environment variables. The model must never see one.
- **Fixtures are synthetic.** Use `example.com` addresses and the fictional 555-01xx numbers. Never commit a real phone number, email address, thread id, deployment URL, token or log excerpt.
- **Keep the lessons in step.** If a change alters what a lesson says, update the lesson in the same pull request.

## Review

Pull requests to `main` need an approving review from the maintainer, and CI must pass. Forks are welcome.
