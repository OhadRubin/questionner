---
name: qa-flow
description: |
  Present structured multi-choice questions to users via MCP-based QA artifacts.
  Use when: (1) Need to ask user multiple structured questions, (2) Gathering preferences
  or requirements through multi-choice options, (3) Clarifying ambiguous instructions with
  structured choices, (4) Getting decisions on implementation choices. Triggers on: "UAUQ",
  "ask me questions", "I need to ask the user", "gather requirements", "clarify with user".
---

# QA Flow

Present structured questions to users via MCP artifacts and wait for responses.

## Critical: Blocking Wait

**`wait_for_user_answer` is a BLOCKING call.** You must actually wait for the result to return - do not fire-and-forget. The call will block until the user submits their answers via the browser.

```python
# CORRECT: Wait for the result
result = await wait_for_user_answer(artifact_id=artifact_id)
answers = result["answers"]  # Now process the answers

# WRONG: Don't just call and move on
await wait_for_user_answer(artifact_id=artifact_id)
# ...continuing without using the result
```

## Workflow

### 1. Register questions

```python
result = await qa_register(questions=[
    {
        "question": "Which database should we use?",
        "header": "Database",
        "multiSelect": False,
        "options": [
            {"label": "PostgreSQL (Recommended)", "description": "Relational, complex queries"},
            {"label": "MongoDB", "description": "Document store, flexible schema"}
        ]
    }
])
artifact_id = result["artifact_id"]
```

### 2. Present artifact to user

Copy `assets/qa_template.html` and inject only the `artifact_id`:

```bash
cp assets/qa_template.html qa_abc123.html
sed -i 's/{{ARTIFACT_ID}}/abc123/' qa_abc123.html
```

The HTML will automatically fetch questions from the server via `qa_get_questions`.

### 3. Wait for answers

```python
result = await wait_for_user_answer(artifact_id=artifact_id, timeout_seconds=300)
answers = result["answers"]
# answers = {"q0": "PostgreSQL (Recommended)", "q1": ["Auth", "Caching"]}
```

## Question Schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `question` | string | Yes | Ends with `?` |
| `header` | string | Yes | Max 12 chars |
| `multiSelect` | bool | Yes | `true` for checkboxes |
| `options` | array | Yes | 2-4 items |
| `options[].label` | string | Yes | 1-5 words |
| `options[].description` | string | Yes | Trade-offs |

## Constraints

- 1-4 questions per artifact
- 2-4 options per question
- "Other" option added automatically (free text)
- Recommended option: put first with "(Recommended)" suffix
- Default timeout: 5 minutes

## Answer Format

Single-select returns string, multi-select returns array:

```json
{
  "q0": "PostgreSQL (Recommended)",
  "q1": ["Auth", "Caching"]
}
```

If user selected "Other", the value is their custom text input.
