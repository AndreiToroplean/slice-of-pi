// Posts the state of a pull request's preview on it, from the deploy workflow's actions/github-script steps. Edits the
// same comment on every run instead of adding one each time.
const MARKER = '<!-- pr-preview -->';

/**
 * @param {{ github: any, context: any, state: 'published' | 'removed' }} args
 */
module.exports = async ({ github, context, state }) => {
  const { owner, repo } = context.repo;
  const issue_number = context.issue.number;
  const url = `https://${owner.toLowerCase()}.github.io/${repo}/pr-${issue_number}/`;
  const text =
    state === 'published'
      ? `🥧 **Preview:** ${url}\n\nBuilt from ${context.payload.pull_request.head.sha}. GitHub Pages can take a minute to serve a new build.`
      : '🥧 The preview was removed now that this pull request is closed.';
  const body = `${MARKER}\n${text}`;

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number,
  });
  const existing = comments.find(
    (comment) => comment.user?.type === 'Bot' && comment.body?.startsWith(MARKER),
  );
  if (existing) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
  } else {
    await github.rest.issues.createComment({ owner, repo, issue_number, body });
  }
};
