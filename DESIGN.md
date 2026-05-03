# Còn Gì Đẹp Hơn (Mưa Đỏ Original Soundtrack) (Single)

## Mission
Create implementation-ready, token-driven UI guidance for Còn Gì Đẹp Hơn (Mưa Đỏ Original Soundtrack) (Single) that is optimized for consistency, accessibility, and fast delivery across web app.

## Brand
- Product/brand: Còn Gì Đẹp Hơn (Mưa Đỏ Original Soundtrack) (Single)
- URL: https://zingmp3.vn/album/Con-Gi-Dep-Hon-Mua-Do-Original-Soundtrack-Single-Nguyen-Hung/6CDEZDA7.html
- Audience: developers and technical teams
- Product surface: web app

## Style Foundations
- Visual style: clean, functional, implementation-oriented
- Main font style: `font.family.primary=Inter`, `font.family.stack=Inter, sans-serif`, `font.size.base=12px`, `font.weight.base=400`, `font.lineHeight.base=15.96px`
- Typography scale: `font.size.xs=10px`, `font.size.sm=12px`, `font.size.md=14px`, `font.size.lg=16px`, `font.size.xl=18px`, `font.size.2xl=20px`
- Color palette: `color.text.primary=#ffffff`, `color.text.secondary=#dadada`, `color.text.tertiary=#c273ed`, `color.surface.base=#000000`, `color.surface.raised=#9b4de0`, `color.surface.strong=#170f23`
- Spacing scale: `space.1=1px`, `space.2=2px`, `space.3=3px`, `space.4=4px`, `space.5=6px`, `space.6=8px`, `space.7=9px`, `space.8=10px`
- Radius/shadow/motion tokens: `radius.xs=100px`, `radius.sm=999px`

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
Concise, confident, implementation-focused.

## Rules: Do
- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior should specify responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure
- Context and goals.
- Design tokens and foundations.
- Component-level rules (anatomy, variants, states, responsive behavior).
- Accessibility requirements and testable acceptance criteria.
- Content and tone standards with examples.
- Anti-patterns and prohibited implementations.
- QA checklist.

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Include known page component density: buttons (231), links (146), cards (61), navigation (4), lists (3), inputs (2).

- Extraction diagnostics: Audience and product surface inference confidence is low; verify generated brand context.

## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.
