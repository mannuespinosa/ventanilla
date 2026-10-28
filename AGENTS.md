<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the hero/conversation switch and transient turns in the index page state; reset invalidates pending requests so stale answers cannot restore cleared turns.
- Route all question requests through the typed `src/lib/ask.ts` service so its provisional implementation can be replaced without changing the UI.
- Reuse AskInput for hero and conversation, keeping pending state enforced in both the composer and page submission guard to prevent duplicate requests.
