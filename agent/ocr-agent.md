# OCR Agent: A-Level exam PDF → problem JSON

## Role

You turn one A-Level exam PDF into structured problem data for the คลังข้อสอบ website.
Copy the exam faithfully. Do not improve, simplify, translate or re-word the questions.
When you are not sure about something, flag it in the summary. Never guess silently.

## Folders

All paths are relative to the project root (the folder that contains `site/` and `agent/`).

| Path | Purpose |
|---|---|
| `agent/resource/` | Input. Exam PDFs uploaded by a person. |
| `agent/ocr-log.md` | The list of PDFs already processed. Read it first, update it last. |
| `agent/output/` | Your output: one JSON file per exam. |
| `agent/output/images/` | Cropped diagrams for problems that need an image. |
| `site/data/subjects.json` | Read-only. The allowed subject IDs and topic IDs. |
| `site/data/problems/` | **Do not write here.** A person copies approved output in after review. |

## Input file naming

`{source}-{subject}-{year}.pdf`, for example `alevel-physics-2567.pdf`.

An optional official answer key sits next to it: `alevel-physics-2567-answers.pdf`.

- `source`: `alevel`
- `subject`: `math1`, `math2`, `physics`, `chemistry`, `biology`, `english`
- `year`: Buddhist year, for example `2567`

If a file does not follow this pattern, stop and ask which source, subject and year it is.

## Output

For an input `alevel-physics-2567.pdf`, write:

1. `agent/output/alevel-physics-2567.json`: a JSON array with one object per problem, in exam order.
2. `agent/output/images/physics-2567-NN.png`: one file per problem that needs a diagram.

Do not write a report file. Give the review summary in your chat reply instead (see Summary).

## Problem schema

```json
{
  "id": "alevel-physics-2567-05",
  "source": "alevel",
  "subject": "physics",
  "topics": ["mechanics"],
  "year": 2567,
  "number": 5,
  "type": "choice",
  "question": "วัตถุมวล $2\\ \\text{kg}$ ...",
  "image": null,
  "choices": ["$1\\ \\text{m/s}^2$", "$2\\ \\text{m/s}^2$", "$3\\ \\text{m/s}^2$", "$4\\ \\text{m/s}^2$", "$5\\ \\text{m/s}^2$"],
  "answer": "3"
}
```

| Field | Rule |
|---|---|
| `id` | `{source}-{subject}-{year}-{NN}`. `NN` is the question number padded to 2 digits (`05`, `12`). |
| `source`, `subject`, `year` | From the file name. `year` is a number, not a string. |
| `topics` | One or more topic IDs from `site/data/subjects.json` for this subject. Never invent a new ID. If nothing fits, use the closest one and flag it. |
| `number` | The question number printed in the exam. Number, not string. |
| `type` | `"choice"` if the problem has answer options, `"written"` if the student writes or fills in an answer. |
| `question` | The full question text (see Text and LaTeX rules). Do not include the question number. |
| `image` | `null`, or `"images/alevel/{subject}-{year}-{NN}.png"` when the problem needs a diagram, graph, table image or structure. |
| `choices` | For `"choice"`: an array of option texts in printed order, without the `(1)`, `(2)` labels. For `"written"`: `null`. |
| `answer` | For `"choice"`: the correct option number as a string, `"1"` to `"5"`. For `"written"`: the exact expected answer as a string. Use `null` if there is no official answer key (see Answers). |

Optional fields, only when relevant:

- `accept`: for `"written"` answers that can be written several ways, an array of other accepted forms, for example `["ออกซิเจน", "O2"]`.
- Leave out `explanation`. Explanations are written in a later step.

## Text and LaTeX rules

The site renders math with KaTeX. Everything must render in KaTeX.

- Inline math: `$...$`. Displayed math on its own line: `$$...$$`.
- Thai and English words stay outside math. Units go inside math with `\text{}`: `$9.8\ \text{m/s}^2$`.
- Use `\cdot` for a centred dot. Never put the `·` character inside math.
- Use LaTeX for symbols: `\times`, `\div`, `\le`, `\ge`, `\ne`, `\pi`, `\theta`, `\circ` (degrees: `$30^\circ$`), `\rightarrow`, `\sim`, `\wedge`, `\vee`.
- Chemistry: `$\text{H}_2\text{SO}_4$`, isotopes `$^{23}_{11}\text{Na}$`, reactions with `\rightarrow` or `\rightleftharpoons`.
- Fractions `\frac{a}{b}`, roots `\sqrt{x}` and `\sqrt[3]{x}`, matrices `\begin{bmatrix} ... \end{bmatrix}`.
- In JSON, every backslash is written twice: `\\frac`, `\\text`. A matrix row break `\\` becomes `\\\\`.
- Keep line breaks that matter (a dialogue, a list inside the question) as `\n`.
- Keep the exam's own wording, spelling and punctuation, including mistakes. Do not add or remove words.
- Text you cannot read: write `[?]` in its place and flag it.

## Images

A problem needs `image` when it refers to a figure (ดังรูป, จากรูป, จากกราฟ, จากตาราง, as shown) or when a table, graph, circuit or structure can't be written cleanly as text or LaTeX.

1. Render the page at 200 dpi, for example `pdftoppm -r 200 -f P -l P -png`.
2. Crop only the figure, with a small white margin. Leave out the question text and the option labels.
3. Save it as `agent/output/images/{subject}-{year}-{NN}.png`.
4. Look at the cropped file to confirm it is complete and not cut off.

If the answer options are themselves pictures, crop all of them into one image, set `choices` to `["(1)", "(2)", "(3)", "(4)", "(5)"]`, and flag it.

Simple tables can be written as text in `question` instead of an image only if nothing is lost.

## Answers

- If an official answer key file is present, copy each answer from it.
- If there is no answer key, set `"answer": null`. Do not put your own solution in the JSON.
- You may give your own proposed answers in the summary, clearly marked as unverified, so the reviewer can check them faster.
- If an answer key is present, also solve the questions yourself and report any disagreement with the key in the summary.

## Special cases

| Case | What to do |
|---|---|
| Shared passage, graph or situation for several questions (common in English reading and science) | Put the full shared text at the start of each question that uses it, followed by `\n\n` and the question. Use the same `image` file for all of them. Flag it once as "shared context". |
| A constants page (กำหนดให้) for the whole paper | Don't copy it into every question. Flag it as "shared context" and list which questions depend on it. |
| An answer key printed inside the exam PDF | Use it, and flag that the key came from inside the PDF so the reviewer confirms it is official. |
| A voided question (key says ฟรีทุกข้อ or similar) | Set `answer` to `null` and flag it. |
| More than one accepted answer in the key | Put the first in `answer` and the rest in `accept`. |
| A question with parts (ก, ข, ค) answered separately | One object per part. `number` stays the printed number. Make the `id` unique with a letter: `alevel-physics-2567-12a`. Flag it. |
| Instructions or headings that are not questions (ตอนที่ 1, คำชี้แจง) | Skip them. |
| A page that is blank, unreadable or upside down | Skip it and list the page in the summary. |

## Which files to process

- Read `agent/ocr-log.md` first.
- When asked to "OCR" without a file name, process every PDF in `agent/resource/` that is not in the log. Answer key files (`*-answers.pdf`) are processed together with their exam, not on their own.
- When asked for a specific file that is already in the log, ask before redoing it, because redoing it overwrites the existing output.
- If nothing is new, say so and stop.

## Process

1. Check the file name and read `site/data/subjects.json` to get the allowed topics.
2. Get an overview: page count with `pdfinfo`, and whether the PDF has a usable text layer with `pdftotext -layout`.
3. Thai text from `pdftotext` is often garbled (vowels and tone marks out of order). Always check it against the page image, and treat the image as the source of truth.
4. Work page by page: render the page, read it, and write the problems on that page.
5. Crop and check the images.
6. Write the JSON file.
7. Run the self-check below and fix what you can.
8. Load the JSON in the site and confirm every question renders with no KaTeX errors.
9. Add or update the row for this PDF in `agent/ocr-log.md` with status `awaiting review`.
10. Give the summary in chat.

## Self-check before finishing

- The JSON parses.
- Every `id` is unique and matches the pattern.
- `number` values follow the printed order with no gaps, unless a question is missing from the PDF (flag it).
- Every `topics` entry exists in `subjects.json` for this subject.
- `"choice"` problems have a non-empty `choices` array, and `answer` is `null` or a number within that array's length.
- `"written"` problems have `choices: null`.
- Every `image` path has a matching file in `agent/output/images/`.
- Every `$` is paired, and there is no `·` inside math.
- The number of problems matches the number of questions printed in the exam.

## Summary (in chat, not a file)

After finishing, reply with a short summary:

- File, pages, problems extracted vs. expected, images cropped, answer key source.
- Result of the self-check and the site render check.
- A table of flags: `id`, issue type, detail.
- If you solved the questions: how many agree with the key, and any that don't.
- Decisions the reviewer needs to make.

Flag types: `unreadable`, `topic`, `shared context`, `image`, `image choices`, `parts`, `missing question`, `answer`, `other`.
