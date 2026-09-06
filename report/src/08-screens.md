# Screen Layouts

This chapter presents the interface in the order a user meets it: arriving, signing in, asking a question, managing documents and projects, controlling retrieval, adjusting the system, and finally the administrator's view and the phone layout. Every screen is a capture of the running application against the seeded account described in §5.4. The answers shown are real answers from `llama3.2:3b` running locally, not mock-ups.

Desktop screens were captured at 1440 × 900 and phone screens at 414 × 896. Screens that are meant to be read whole, the landing and feature pages, are full-page captures; the rest are viewport captures, so that they sit at a consistent size on the page.

Four screens have already appeared where they carried an argument and not merely illustrating one: the landing page and a grounded answer in Chapter 1, the sources panel and one opened passage in Chapter 3, private mode in Chapter 6, and the library, usage, dashboard and query log in Chapter 7. They are not repeated here.

## Arriving

![The landing page in dark theme. The theme is a swap of custom-property values, not a second stylesheet, which is why every component follows it without being told to.](../docs/screenshots/02-landing-dark.png){width=4.3}

![The feature overview. Each claim on this page is one the rest of this report substantiates.](../docs/screenshots/03-features.png){width=5.6}

![Signing in. The form states its own rules instead of reporting them after a failed attempt.](../docs/screenshots/05-login.png){width=5.6}

![Registration. Username and email are both unique, and the uniqueness is enforced by the schema as well as checked here.](../docs/screenshots/06-register.png){width=5.6}

## Asking

![A new conversation. The suggested prompts are drawn from what the user's own library can answer, so a first question is not a guess.](../docs/screenshots/07-new-chat.png){width=5.6}

![The same answer in dark theme. Every colour in the interface is a custom property, so a theme is a swap of values.](../docs/screenshots/25-dark-theme.png){width=5.6}

## Reading a Document

![Reading view. The document is rendered as the user would expect to read it.](../docs/screenshots/12-document-reader.png){width=5.6}

![Source view. This is more useful than it looks: it shows the characters the parser actually extracted, with line numbers. What is on screen here is exactly what was chunked and embedded, which makes it the fastest way to tell a bad extraction from a bad answer.](../docs/screenshots/13-document-source-view.png){width=5.6}

## Projects

![The projects list. A project is a workspace with its own standing instructions and its own set of documents.](../docs/screenshots/14-projects.png){width=5.6}

![Inside a project. The standing instructions and the attached documents are both visible, because both change what an answer in this project can be built from.](../docs/screenshots/15-project-page.png){width=5.6}

## Controlling Retrieval and the Model

![Model selection. Local models and cloud models appear in one list, and the choice is made per question rather than per deployment.](../docs/screenshots/16-model-picker.png){width=5.6}

![Restricting retrieval to a single document. The scope is applied inside the vector search, so passages outside it are never candidates.](../docs/screenshots/17-retrieval-scope.png){width=5.6}

![Adding a document from the composer, without leaving the conversation.](../docs/screenshots/18-add-menu.png){width=5.6}

![Settings: model and retrieval parameters. The number of passages retrieved is the *k* of §3.2.4, exposed rather than fixed.](../docs/screenshots/31-settings-model.png){width=5.6}

## Navigating a Library That Accumulates

![Searching conversations. A knowledge system accumulates, so search is part of the navigation, not an extra page.](../docs/screenshots/19-search-chats.png){width=5.6}

![The sidebar collapsed to its rail, for a user who wants the width.](../docs/screenshots/20-sidebar-collapsed.png){width=5.6}

![The sidebar with all three groups folded shut. Conversations group by age, and each group folds independently.](../docs/screenshots/21-sidebar-groups-folded.png){width=5.6}

![The account menu: theme, language and settings, reachable from every page.](../docs/screenshots/22-account-menu.png){width=5.6}

## Settings

![Settings: general. Theme, language and the standing instructions that ride above the grounding rules on every answer.](../docs/screenshots/26-settings-general.png){width=5.6}

![Settings: account. Changing a password, and deleting the account together with every document, conversation and vector belonging to it.](../docs/screenshots/27-settings-account.png){width=5.6}

![Settings: privacy. What is stored, and what private mode does not store.](../docs/screenshots/28-settings-privacy.png){width=5.6}

![Settings: knowledge base. The size of the library as the system sees it: documents, indexed chunks and bytes.](../docs/screenshots/30-settings-knowledge.png){width=5.6}

## The Phone Layout

The interface is responsive to 414 px without horizontal scrolling. Below the breakpoint the sidebar becomes a drawer over a backdrop; the defects found in getting that drawer right are recorded as D7 in §5.6.

![A new conversation on a phone. The composer keeps its full function; nothing is removed to fit.](../docs/screenshots/34-mobile-new-chat.png){width=2.3}

![A grounded answer on a phone, with the retrieval line intact. The provenance is not the thing that gets dropped at a small width.](../docs/screenshots/36-mobile-answer.png){width=2.3}

![Private chat on a phone.](../docs/screenshots/37-mobile-private-chat.png){width=2.3}

![The same answer in dark theme, at phone width.](../docs/screenshots/38-mobile-dark-answer.png){width=2.3}

![The navigation drawer open in dark theme. The drawer carries its own closing control, because at this width the control that opened it is behind the drawer.](../docs/screenshots/39-mobile-dark-sidebar.png){width=2.3}
