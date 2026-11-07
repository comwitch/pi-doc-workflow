<!-- pi-doc-workflow template=0.1.0 audience=human -->
# Human Knowledge Notes

These rules apply to articles in this directory, not to this instruction file.
Read this file explicitly before creating or editing an article.

## Audience and purpose

- Write for a person who wants to remember and understand one topic, never for an AI agent.
- Create or update a note only when the user requests it. Do not archive every conversation or task.
- Default to Korean. Use English only when the user requests it.
- Keep one topic per article and one idea per section, paragraph, or list item.
- Include only the information worth remembering now. Leave optional depth for follow-up questions.
- Prefer natural, concise sentences over telegraphic fragments, repetition, and exhaustive background.

## Length

- Aim for approximately 40-50 characters per sentence and approximately 300 characters per prose paragraph.
- Keep each finished article between 1,500 and 3,000 characters unless the user explicitly requests another length.
- Count Unicode characters, including spaces, in the visible Markdown body. Exclude YAML frontmatter, HTML comments, fenced code blocks (including Mermaid), and display-math blocks. Include prose, headings, lists, captions, and inline math source. This is a source-text convention, not a count of rendered glyphs.
- Sentence and paragraph lengths are approximate readability targets. The article range is a completion check.
- Do not pad weak material to reach the minimum or remove essential qualifications to fit the maximum. Narrow or split the topic, or ask the user to approve a shorter note.

## Obsidian, equations, and diagrams

- Use plain Markdown compatible with Obsidian. No plugin-specific rendering is required.
- Use `$...$` for inline math and `$$` blocks for display math.
- Use fenced `mermaid` blocks for diagrams; keep node labels short and quote labels containing punctuation.
- Normally include a meaningful equation and a diagram when they clarify the topic. Never invent irrelevant mathematics to satisfy a format; explain an omission when one representation does not apply.
- Introduce what each equation explains. Define its symbols, assumptions, units, and coordinate frames where relevant.
- Explicitly identify frame or unit conversions. Check dimensional consistency.
- Explain what each diagram shows and what its arrows mean. A diagram must not replace the prose explanation.
- Use relative links or Obsidian `[[wikilinks]]` when useful. Do not add empty index pages or placeholder articles.

## Suggested article shape

1. A title naming one topic.
2. The few central facts worth remembering and why they matter.
3. A mathematical explanation with definitions and conditions.
4. A Mermaid diagram with a short interpretation.
5. Practical limits and common misunderstandings.

## Accuracy and final check

- Do not invent facts, references, examples presented as observations, or results.
- Cite a compact source link where a nontrivial claim needs support; avoid turning the note into an agent activity log.
- If research or code inspection does not settle a point, say that it is unknown and identify the limit.
- Re-read for a human audience, verify the character budget, and remove redundant sentences.
- Preserve existing notes and project-specific rules; make only the changes requested by the user.
