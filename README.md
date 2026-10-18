# mcq-runner

[English](README.md) | [简体中文](README.zh-CN.md)

A lightweight, dependency-free multiple-choice quiz runner that runs entirely in the browser. The front end and question banks are separate: open the app, choose a JSON bank, and start answering. There is no server, build step, account, or network request.

The interface is currently in Simplified Chinese.

## Features

- Single-answer and multiple-answer questions.
- Two answer-review modes, configured per question bank:
  - `immediate` — show the answer and explanation after each question.
  - `afterAll` — hide answers until every question has been answered.
- Previous/next navigation with selections preserved while reviewing.
- Tightly controlled navigation: submitted answers cannot be changed in `immediate` mode, while `afterAll` mode allows answers to be revised until the final result is requested.
- Final results split into **Wrong Answers & Explanations** and **Correct Answer Explanations**.
- Detailed question-bank validation with explicit error messages.
- Minimal, retro, tkinter-inspired visual design with no external assets or fonts.
- Keyboard-accessible native radio buttons, checkboxes, and buttons.
- Responsive layout down to narrow mobile viewports.

## Quick start

1. Open `index.html` directly in a modern browser such as Edge, Chrome, or Firefox.
2. Click **选择题库…** ("Choose question bank").
3. Select `example-bank.json` or your own UTF-8 JSON bank.
4. Answer the questions according to the bank's review mode.
5. On the results screen, review wrong and correct answers, retry the same bank, or choose another bank.

No local server is required. The app reads the selected file locally through the browser's File API.

## Review modes

Set the top-level `reviewMode` field in the question bank.

| Value | Behavior |
| --- | --- |
| `immediate` | Each question is submitted individually. Feedback, the correct answer, and the explanation are shown immediately, and that question's answer is locked. |
| `afterAll` | Answers stay hidden while working. Use **上一题** (Previous) and **下一题** (Next) to navigate; selections are preserved. **查看结果** (View Results) becomes available once every question has at least one selected answer. |

If `reviewMode` is omitted, it defaults to `immediate` for compatibility with earlier banks.

### `immediate`

- Select an answer and click **提交答案** (Submit Answer).
- The result and explanation appear immediately.
- **上一题** (Previous) lets you review previously submitted questions; **下一题** (Next) continues.
- After the final submission, click **查看结果** (View Results).

### `afterAll`

- Answers are recorded as you select them, but no correctness information is shown.
- **上一题** and **下一题** move between questions.
- The **查看结果** button remains disabled until all questions have a selection.
- All questions are graded together when results are requested.

## Question bank format

A question bank is a single UTF-8 JSON file. Questions are presented in array order.

```json
{
  "title": "Web Basics",
  "reviewMode": "immediate",
  "questions": [
    {
      "question": "Which file extension is used for HTML documents?",
      "options": ["html", "txt", "exe", "css"],
      "answer": "A",
      "explanation": "HTML documents use the .html extension."
    },
    {
      "question": "Which of these are web browsers?",
      "options": ["Edge", "Chrome", "Photoshop", "Firefox"],
      "answer": ["A", "B", "D"],
      "explanation": "Edge, Chrome, and Firefox are browsers; Photoshop is an image editor."
    }
  ]
}
```

### Fields

| Field | Required | Description |
| --- | --- | --- |
| `title` | No | Bank name shown in the quiz and results screens. If omitted or empty, the file name without `.json` is used. Must be a string. |
| `reviewMode` | No | `"immediate"` or `"afterAll"`. Defaults to `"immediate"`. |
| `questions` | Yes | Non-empty array of question objects. |
| `questions[].question` | Yes | Non-empty question text. Newlines are supported. |
| `questions[].options` | Yes | Array of 2–26 non-empty strings. |
| `questions[].answer` | Yes | A single letter for single-answer questions (for example `"A"`), or an array of letters for multiple-answer questions (for example `["A", "C"]`). Case-insensitive. |
| `questions[].explanation` | No | Explanation shown on feedback and results screens. Must be a string. |

Unknown fields are ignored.

### Answer rules

- Options are labeled A, B, C, and so on in array order.
- A string `answer` produces radio buttons and is graded as single-answer.
- An array `answer` produces checkboxes and is graded as multiple-answer, even when the array contains only one letter.
- Multiple-answer questions require an exact set match; there is no partial credit.
- The final percentage is rounded to the nearest integer.

## Results

Both modes end with the same two result sections:

- **错题与解析** (Wrong Answers & Explanations): question, your answer, the correct answer, and the explanation.
- **正确题目解析** (Correct Answer Explanations): question, the correct answer, and the explanation.

If one group is empty, the results screen says **无错题。** ("No wrong answers.") or **无正确题目。** ("No correct answers."). If a question has no explanation, the screen shows **解析：题库未提供解析。** ("Explanation: no explanation was provided.").

## Validation

The entire file is validated before the quiz starts. Invalid banks remain on the start screen with a specific error. The app rejects:

- invalid JSON;
- a non-object root;
- a missing, non-array, or empty `questions` array;
- a `reviewMode` other than `"immediate"` or `"afterAll"`;
- empty question or option text;
- option counts outside 2–26;
- malformed, out-of-range, or duplicate answer letters;
- non-string `title` or `explanation` values.

Save banks as UTF-8 to avoid garbled Chinese text. In Windows Notepad, choose UTF-8 when saving.

## Keyboard and navigation

- Use Tab to move through options and buttons.
- Radio buttons support arrow-key selection; checkboxes support Space.
- In `immediate` mode, a submitted question is locked but can still be reviewed.
- In `afterAll` mode, answers can be changed until results are requested.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Application entry point. Open this file to start. |
| `styles.css` | Minimal retro tkinter-style styling. |
| `app.js` | Bank loading, validation, quiz state, navigation, grading, and results. |
| `example-bank.json` | Ready-to-use example bank using `immediate` mode. |
| `README.md` | English documentation. |
| `README.zh-CN.md` | Simplified Chinese documentation. |
| `LICENSE` | MIT license. |

## Browser support

Modern Edge, Chrome, and Firefox releases are supported. The app works when opened directly from disk (`file://`) and reads question banks only after the user selects them. There are no external dependencies, CDNs, or network requests.

Quiz state is kept in memory only. Refreshing the page clears the current attempt.

## License

Released under the [MIT License](LICENSE).

Copyright (c) 2026 Zhang Yiran.
