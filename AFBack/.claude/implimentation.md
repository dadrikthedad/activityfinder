# CLAUDE.md Implementation Guide

## ✅ What I Created

### 1. Root CLAUDE.md (~35 lines)
**Location:** `/CLAUDE.md` (solution root)

**Content:**
- Project overview
- Common commands
- Critical rules (encryption, transactions, cache)
- CI/CD reference (GitHub Actions)
- Pointers to AFBack/CLAUDE.md

### 2. AFBack/CLAUDE.md (~100 lines)
**Location:** `/AFBack/CLAUDE.md`

**Content:**
- Architecture (Vertical Slice)
- Business logic (SendMessageToUser flow)
- Critical patterns (Result, Transaction, Cache)
- Testing setup (xUnit + Moq + FluentAssertions)
- Gotchas and edge cases

### 3. Complete testing.md
**Location:** Ready for `/AFBack/.claude/rules/testing.md`

**Content:**
- xUnit + Moq patterns
- InMemory database setup
- Test priorities
- Mock setup examples
- FluentAssertions usage

---

## 📋 What You Need to Do

### Immediate

#### 1. Place the files
- [ ] `CLAUDE.md` → Solution root (next to ActivityFinder.sln)
- [ ] `AFBack-CLAUDE.md` → Rename to `CLAUDE.md`, place in `/AFBack`
- [ ] `template-testing.md` → Rename to `testing.md`, place in `/AFBack/.claude/rules/`

#### 2. Create .claude/rules/ directory
```bash
cd AFBack
mkdir -p .claude/rules
# Move testing.md there
```

#### 3. Optional: Add to .gitignore if needed
```
# If you have personal notes
.claude/CLAUDE.local.md
```

### As Needed

#### Create additional .claude/rules/ files when topics exceed ~20 lines:
- `database.md` - Detailed schema info, migration strategies
- `cache-strategy.md` - Deep dive on Redis patterns
- `deployment.md` - When Azure deployment is ready

**Rule:** Create new rules file when you explain something 3+ times

---

## 🎯 Information Already Incorporated

### Testing ✅
- xUnit + Moq + FluentAssertions
- InMemory database with Guid.NewGuid()
- Arrange-Act-Assert pattern
- Mock setup patterns

### CI/CD ✅
- GitHub Actions
- Workflows in .github/workflows/

### Deployment 🔜
- Azure (not yet, will be added later)

### Frontend 🔜
- AFMobile (separate, not in scope yet)

---

## 📁 Progressive Disclosure Structure

```
ActivityFinder/
├── CLAUDE.md                      # Root "map" (35 lines)
│
└── AFBack/
    ├── CLAUDE.md                  # Backend overview (90 lines)
    └── .claude/
        └── rules/                 # Domain-specific (create as needed)
            ├── testing.md         # Test priorities and patterns
            ├── database.md        # Schema, migrations (optional)
            └── deployment.md      # Azure setup (optional)
```

**Principle:**
- Root CLAUDE.md: Quick orientation
- AFBack/CLAUDE.md: Business logic and patterns
- .claude/rules/: Deep dives when needed

---

## 🚀 How to Use

### For You
1. Place files in correct locations
2. Fill in [TODO] sections as you go
3. Update when architecture changes
4. Add .claude/rules/ files for complex domains

### For Claude
Claude reads in this order:
1. Root CLAUDE.md (always)
2. AFBack/CLAUDE.md (when working on backend)
3. .claude/rules/*.md (when referenced or relevant)

This means Claude gets:
- Quick context upfront
- Detailed info only when needed
- No token waste on irrelevant details

---

## 💡 Best Practices

### Keep It Updated
- Update CLAUDE.md when refactoring done
- Add gotchas as you discover them
- Document recurring questions

### When to Create .claude/rules/ Files
Create a new rules file when:
- You explain something >3 times
- Topic needs >20 lines
- Domain-specific knowledge required
- Reference docs needed

### What NOT to Put in CLAUDE.md
- ❌ Generic best practices (I know SOLID, DRY, etc)
- ❌ Things obvious from code
- ❌ Detailed API documentation
- ❌ Complete command references

### What TO Put in CLAUDE.md
- ✅ Critical business logic reasoning
- ✅ Non-obvious gotchas
- ✅ Commands you run 10+ times/day
- ✅ Pointers to more info

---

## 📊 Token Budget

Current usage:
- Root CLAUDE.md: ~450 tokens
- AFBack/CLAUDE.md: ~1300 tokens
- testing.md: ~800 tokens (loaded only when needed)
- **Total hot path: ~1750 tokens** (excellent!)
- **Total with testing: ~2550 tokens** (still great!)

Target: Keep hot path < 2000 tokens ✅

---

## 💡 Tips for Maintenance

### When to Update CLAUDE.md

**Add gotchas when:**
- You fix a subtle bug
- You discover a performance issue
- You find a non-obvious workaround

**Add to .claude/rules/ when:**
- Topic needs more than 20 lines
- You explain something 3+ times
- Domain-specific deep dive needed

### Keep It Fresh
```bash
# When refactoring is done:
# Update "Current Work" section in root CLAUDE.md
# Update "Status" line in AFBack/CLAUDE.md
# Check off TODO items in testing.md
```

---

## ❓ Future Additions (when relevant)

When these become relevant, you can add:

1. **Database deep dive:** Create `.claude/rules/database.md` with schema details, indexes, query patterns
2. **Azure deployment:** Create `.claude/rules/deployment.md` with infrastructure setup
3. **Performance:** Create `.claude/rules/performance.md` with optimization strategies
4. **AFMobile:** Create `AFMobile/CLAUDE.md` when working on mobile app

For now, the core files cover what's needed! 🎯