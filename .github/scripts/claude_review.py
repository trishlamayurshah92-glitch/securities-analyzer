#!/usr/bin/env python3
"""
Claude PR Reviewer — sends PR diff to Claude for concept-oriented code review,
then posts the review as a GitHub PR comment.
"""

import os
import sys
from pathlib import Path

import anthropic
from github import Github

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MAX_DIFF_CHARS = 180_000  # Stay well within Claude's context window
MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = """\
You are a senior engineer doing a thorough, narrative-style code review on a \
GitHub pull request. Your job is to help the author and reviewers understand \
*what changed and why* — not just list files.

## How to review

### 1. Identify Concepts
Read the entire diff. Group the changes into **distinct concepts or features**. \
A concept is a coherent idea that may span multiple files.

Good examples: "Add rate limiting to the API layer", "Migrate auth to JWT", \
"Introduce structured logging".

Anti-patterns to avoid:
- Making a concept out of import changes alone
- Grouping unrelated changes because they're in the same file
- Treating formatting tweaks as a concept (mention under Housekeeping if needed)

### 2. Tell the Story of Each Concept
For each concept, walk through these layers in order:

- **Groundwork** — types, interfaces, config, schemas that set the stage
- **Core Logic** — the main algorithm or business logic; explain *why* when \
the approach isn't obvious
- **Integration** — how it wires into the system: routes, middleware, DI, DB, events
- **Validation** — tests, assertions, mocks. If tests are missing, say so.

Reference specific files and functions by name with backtick formatting.

### 3. Code Quality Review
Flag any of these you find (be specific — file, function, concrete suggestion):

- **Code smells**: long functions, deep nesting, primitive obsession, feature envy
- **Design issues**: SRP violations, tight coupling, missing abstractions, \
inconsistent patterns
- **Stale comments**: comments that restate code, commented-out code, \
unaddressed TODO/FIXME/HACK
- **Duplication**: copy-paste logic that should be extracted
- **Other concerns**: missing error handling, hardcoded values, security issues \
(secrets in code, injection vectors), performance red flags (N+1 queries, \
unbounded loops)

If the code is clean, say so. Don't invent problems.

### 4. Summary
End with:
1. **Change Overview** — one sentence on the overall thrust
2. **Concepts Touched** — bulleted list
3. **Risk Assessment** — Low / Medium / High with a one-line justification
4. **Suggested Next Steps** — missing tests, open TODOs, follow-up work

## Formatting
- Use markdown headers, fenced code blocks with language tags, and inline code \
for file paths and symbols.
- Keep the tone direct, constructive, and specific. You are a helpful senior \
colleague, not a linter.
"""


def read_file(path: str) -> str:
    p = Path(path)
    if not p.exists():
        return ""
    return p.read_text(encoding="utf-8", errors="replace")


def truncate_diff(diff: str) -> str:
    """Truncate diff to fit within context limits, keeping the beginning and end."""
    if len(diff) <= MAX_DIFF_CHARS:
        return diff
    half = MAX_DIFF_CHARS // 2
    return (
        diff[:half]
        + "\n\n... [DIFF TRUNCATED — middle section omitted to fit context window] ...\n\n"
        + diff[-half:]
    )


def build_user_message(diff: str, files: str, pr_title: str, pr_body: str) -> str:
    parts = []
    parts.append(f"## Pull Request: {pr_title}\n")
    if pr_body:
        parts.append(f"### PR Description\n{pr_body}\n")
    parts.append(f"### Changed Files\n```\n{files}\n```\n")
    parts.append(f"### Full Diff\n```diff\n{diff}\n```\n")
    parts.append(
        "Please review this PR using the concept-oriented approach described "
        "in your instructions. Provide a thorough, narrative review."
    )
    return "\n".join(parts)


def call_claude(user_message: str) -> str:
    client = anthropic.Anthropic()  # Uses ANTHROPIC_API_KEY env var
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text


def post_review(review_body: str):
    """Post the review as a PR comment via the GitHub API."""
    gh = Github(os.environ["GITHUB_TOKEN"])
    repo = gh.get_repo(os.environ["REPO_FULL_NAME"])
    pr = repo.get_pull(int(os.environ["PR_NUMBER"]))

    header = "## 🔍 Claude Code Review\n\n"
    footer = "\n\n---\n*Automated review by [Claude](https://www.anthropic.com) · concept-oriented analysis*"

    pr.create_issue_comment(header + review_body + footer)


def main():
    diff = read_file("/tmp/pr_diff.txt")
    files = read_file("/tmp/pr_files.txt")
    pr_title = os.environ.get("PR_TITLE", "")
    pr_body = os.environ.get("PR_BODY", "") or ""

    if not diff.strip():
        print("No diff found — nothing to review.")
        return

    diff = truncate_diff(diff)
    user_message = build_user_message(diff, files, pr_title, pr_body)

    print(f"Diff size: {len(diff):,} chars | Sending to Claude ({MODEL})...")
    review = call_claude(user_message)

    print("Review generated. Posting to GitHub...")
    post_review(review)
    print("Done — review posted as PR comment.")


if __name__ == "__main__":
    main()