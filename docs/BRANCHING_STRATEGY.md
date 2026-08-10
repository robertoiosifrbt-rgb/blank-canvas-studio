# Branching Strategy

## Overview

This project uses a simplified Git Flow branching strategy with two main branches:

```
production ← releases only    (stable, production-ready code)
   ↑
main ← all development        (main development branch)
   ↑
feature/* ← feature branches  (development)
```

## Branch Types

### 1. `main` (Principal/Development)
**Purpose**: Main development branch where all features are integrated

**Characteristics**:
- Default branch
- Always builds and passes tests
- Contains the latest development code
- Deploy to staging from this branch

**Guidelines**:
- ✅ Accept PRs from feature branches
- ✅ Must have passing CI/CD
- ✅ Code reviews required
- ❌ Direct commits discouraged (use PRs)

**When to merge to main**:
- Feature is complete and tested
- All tests pass
- Code review approved
- Ready for staging deployment

### 2. `production` (Production Release)
**Purpose**: Production-ready code only

**Characteristics**:
- Stable and tested code
- Tagged with version numbers (v1.0.0, v1.1.0, etc.)
- Never broken or unstable
- Direct deployment to production

**Guidelines**:
- ✅ Only merge from main
- ✅ Always tagged with version
- ✅ Full CI/CD pipeline must pass
- ✅ Hotfixes go here when needed
- ❌ Direct commits NOT allowed

**When to merge to production**:
- Code has been tested on staging
- All acceptance tests pass
- Product owner/stakeholder approval
- Ready for public release

### 3. Feature Branches (e.g., `feature/task-filters`)
**Purpose**: Individual feature development

**Naming Convention**:
```
feature/feature-name          (new feature)
fix/bug-description           (bug fix)
refactor/component-name       (refactoring)
docs/feature-name             (documentation)
```

**Guidelines**:
- Create from: `main`
- Merge into: `main` (via PR)
- Should be deleted after merge
- Keep scope small and focused

**Example**:
```bash
git checkout main
git pull origin main
git checkout -b feature/dark-mode
# ... make changes ...
git push origin feature/dark-mode
# Create PR on GitHub
```

## Workflow

### Adding a New Feature

1. **Update main**:
```bash
git checkout main
git pull origin main
```

2. **Create feature branch**:
```bash
git checkout -b feature/my-feature
```

3. **Make changes**:
```bash
# Edit files
git add .
git commit -m "Add feature description"
```

4. **Push and create PR**:
```bash
git push origin feature/my-feature
# Go to GitHub and create a Pull Request
```

5. **Code review and merge**:
   - Wait for review
   - Address feedback
   - Merge to main via GitHub UI
   - Delete feature branch

### Releasing to Production

1. **Prepare release on main**:
```bash
git checkout main
git pull origin main
npm version patch  # or minor, major
```

2. **Verify**:
```bash
npm run build
npm run lint
npm test  # when tests added
```

3. **Merge to production**:
```bash
git checkout production
git pull origin production
git merge main
git push origin production
```

4. **Tag the release**:
```bash
git tag -a v1.0.0 -m "Version 1.0.0"
git push origin v1.0.0
```

5. **Deploy to production**:
   - Trigger deployment pipeline
   - Verify on production environment
   - Announce release

### Hotfix for Production

If a critical bug is found in production:

1. **Create hotfix branch**:
```bash
git checkout -b hotfix/bug-description origin/production
```

2. **Fix and test**:
```bash
# Make fixes
npm run build
npm run lint
```

3. **Merge to production**:
```bash
git checkout production
git merge hotfix/bug-description
git push origin production
```

4. **Sync back to main**:
```bash
git checkout main
git merge production
git push origin main
```

5. **Clean up**:
```bash
git branch -d hotfix/bug-description
git push origin --delete hotfix/bug-description
```

## Deployment Pipeline

```
Feature Branch
      ↓
Code Review
      ↓
Merge to main
      ↓
Staging Deployment
      ↓
Staging Testing
      ↓
Merge to production
      ↓
Production Deployment
      ↓
Production Verification
```

### Environment Mapping

| Branch | Environment | Auto-Deploy | Access |
|--------|-------------|-------------|--------|
| feature/* | None | No | Private |
| main | Staging | Yes* | Team |
| production | Production | Yes* | Public |

*Auto-deploy requires CI/CD pipeline configuration

## Protected Branches

### Configure GitHub Branch Protection

**For `main` branch**:
1. Go to Settings → Branches
2. Add rule for `main`:
   - ✅ Require pull request reviews
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - ✅ Dismiss stale reviews

**For `production` branch**:
1. Add rule for `production`:
   - ✅ Require pull request reviews (2 reviewers)
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - ✅ Restrict push access (admins only)

## Naming Conventions

### Branch Names

```
feature/task-management      ✅ Good
feature/new-calendar-view    ✅ Good
fix/button-styling           ✅ Good
docs/api-reference           ✅ Good

feature/add-stuff            ❌ Too vague
Feature/NewTask              ❌ Wrong case
my_new_feature               ❌ Wrong format
```

### Commit Messages

Follow conventional commits:

```
feat: add task filtering
fix: correct date display bug
docs: update setup guide
refactor: simplify calendar component
style: fix eslint warnings
test: add task creation tests
chore: update dependencies
```

### Pull Request Titles

```
Add task filtering feature
Fix calendar date display bug
Update API documentation
Refactor Tasks component
```

## Git Commands Reference

### Branch Management

```bash
# List local branches
git branch

# List all branches (local + remote)
git branch -a

# Create new branch
git checkout -b branch-name

# Switch branch
git checkout branch-name

# Delete local branch
git branch -d branch-name

# Delete remote branch
git push origin --delete branch-name

# Rename branch
git branch -m old-name new-name
```

### Syncing

```bash
# Fetch updates from remote
git fetch origin

# Pull latest changes
git pull origin main

# Push changes
git push origin branch-name

# Push and set upstream
git push -u origin branch-name
```

### Merging

```bash
# Merge main into feature
git checkout feature/my-feature
git merge main

# Merge feature into main
git checkout main
git merge feature/my-feature

# Rebase instead of merge
git rebase main
```

## Best Practices

### ✅ Do's

- ✅ Pull latest before starting work
- ✅ Create focused branches (one feature per branch)
- ✅ Write descriptive commit messages
- ✅ Push regularly to avoid losing work
- ✅ Keep branches up-to-date with main
- ✅ Delete merged branches
- ✅ Use PRs for code review
- ✅ Test before submitting PR
- ✅ Keep commits atomic and logical

### ❌ Don'ts

- ❌ Commit directly to main (use PRs)
- ❌ Never commit to production directly
- ❌ Don't mix multiple features in one branch
- ❌ Don't skip code reviews
- ❌ Don't leave stale branches
- ❌ Don't force push to shared branches
- ❌ Don't commit secrets or .env files
- ❌ Don't ignore failing CI/CD checks

## Troubleshooting

### Merge Conflicts

```bash
# See which files have conflicts
git status

# Open files and resolve manually
# Then:
git add resolved-file.js
git commit -m "Resolve merge conflict"
```

### Accidentally Committed to main

```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Create new branch with the changes
git checkout -b feature/my-feature
git commit -m "my changes"
```

### Branch Fell Behind

```bash
git checkout feature/my-feature
git fetch origin
git merge origin/main
# or rebase
git rebase origin/main
```

### Recover Deleted Branch

```bash
# See recent commits
git reflog

# Recreate branch from commit
git checkout -b recovered-branch commit-sha
```

## CI/CD Integration

When setting up GitHub Actions:

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install
        run: npm install
      - name: Build
        run: npm run build
      - name: Lint
        run: npm run lint
```

For production deployment, add:

```yaml
  deploy:
    if: github.ref == 'refs/heads/production'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: # deployment command
```

## FAQ

**Q: Should I merge or rebase?**  
A: For feature branches, rebase to keep history clean. For main/production, use merge commits for clarity.

**Q: How long should a feature branch live?**  
A: Ideally 1-3 days. Longer branches = more conflicts.

**Q: Can I commit to main directly?**  
A: No, always use PRs for code review.

**Q: What if production breaks?**  
A: Use hotfix branch from production, fix, merge back to main.

**Q: How do I tag releases?**  
A: Use semantic versioning: `git tag -a v1.2.3 -m "Release 1.2.3"`

## Resources

- [Git Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow Guide](https://guides.github.com/introduction/flow/)
- [Pro Git Book](https://git-scm.com/book/en/v2)
