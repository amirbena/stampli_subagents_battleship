# Diff Scope Check

Workflow Run ID: 20260625-153237-b050150

README.md changes (+33/-9 lines approx):
- Removed `"theme": "dark",` from settings JSON block.
- Added theme-preference prose note.
- Split single install code block into macOS/Linux + Windows labelled blocks.
- Updated blockquote to mention both `./mvnw` (macOS/Linux) and `mvnw.cmd` (Windows).

Scope: strictly inside `### Project Bootstrap (one-time, before /requirement)` subsection. No other README sections altered. No production code, config, test, or infra files touched. Resulting JSON is syntactically valid.

Result: PASS — in scope.
