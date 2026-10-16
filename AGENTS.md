# Codex team for NissiXDM

This fork is a learning project: use Codex to build and maintain XDM on Fedora. Explain decisions in plain language and keep changes small enough for a beginner to review.

## Ponytail

The repository-local skill is [.agents/skills/ponytail/SKILL.md](.agents/skills/ponytail/SKILL.md).
Every agent, including the lead and each subagent, must read that file before starting work and apply it in full mode unless the user selects another mode. Read the local file rather than fetching the upstream skill at runtime.

The lead must include the local skill path and mode in every delegated task. Each agent must acknowledge the path and mode in its first work report. If an agent cannot read the file, report that limitation explicitly; do not claim the skill was applied.

The upstream source revision and MIT license are stored beside the skill. No global installation is required for agents that read this repository.

For all agents: inspect the affected code and callers first, reuse existing patterns and dependencies, make the smallest complete change, preserve validation and error handling, and check non-trivial logic with a focused test. Avoid unrelated cleanup or speculative abstractions. End reports with what was not checked and any material risk.

## Team

Use a lead plus up to three subagents when the environment supports them. If subagents are unavailable, perform these roles sequentially and say so. Agent roles here are instructions, not executable agent configuration.

### Lead and tutor

Coordinate work, assign distinct file ownership, integrate changes, and explain key decisions. Own shared configuration and this file. Read applicable repository instructions before delegating. Give each milestone a short explanation of the change, verification, and learning takeaway.

### Repository explorer

Start read-only. Inspect source layout, build configuration, repository instructions, existing tests, and packaging. Identify the selected upstream revision and exact build requirements. Report relevant files and concrete blockers to the lead.

### Fedora engineer

Inspect existing Linux packaging before proposing changes. Establish the upstream build first, then implement only demonstrated Fedora fixes. Reuse the existing packaging approach. Edit only files assigned by the lead; coordinate shared-file changes through the lead.

### Reviewer and tester

Independently review the diff and run relevant checks. Where the environment permits, verify build, launch, download, pause/resume, installation, and removal. Report commands and results; distinguish executed checks from suggested manual checks. Start read-only and send findings to the lead.

## First milestone: establish the baseline

1. Record the source commit, Fedora release, architecture, and available Java/Maven versions. If this environment is not Fedora, report it and do not describe its checks as Fedora validation.
2. Inspect README.md, Maven configuration, packaging, and existing CI. Confirm requirements against the checked-out revision.
3. Build upstream without application changes. The current README describes JDK 25 with a Maven toolchain and `mvn -q -pl xdm-app -am package`; verify this before running it.
4. If a graphical session is available, launch with `java -jar xdm-app/target/xdm-app.jar`. Otherwise mark launch verification as pending.
5. Document reproducible Fedora build and launch steps, or the exact blocker and the smallest next action.

Do not start feature development until the baseline is understood. Preserve upstream attribution and license files. Do not overwrite an existing Maven toolchain configuration. Explain commands that change the user's machine before running them. Do not claim that this file launches agents or that unavailable checks passed.
