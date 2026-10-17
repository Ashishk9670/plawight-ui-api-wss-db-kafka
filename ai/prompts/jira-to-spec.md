# Turn Jira / Confluence acceptance criteria into specs

Prerequisite: the Atlassian connector is available in your Claude / Copilot session.

Prompt (fill in the issue key):

> Read Jira issue **<KEY>** (and any Confluence page it links) with the Atlassian tools. Extract the acceptance
> criteria as a numbered list of testable statements. Then:
>
> 1. Classify each statement by layer (ui / rest / graphql / websocket / kafka / db / e2e) and say why.
> 2. Write a plan to `specs/<KEY>.md`: scenario, preconditions (which fixture creates the data), steps, expected
>    result, tags. Flag any criterion that is ambiguous or untestable and ask me before guessing.
> 3. Stop for my review. After approval, follow `generate-test.md` for each scenario.
>
> Read-only on Jira: do not comment on, transition or edit the issue.
