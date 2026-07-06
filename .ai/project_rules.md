# FinWise AI — Project Rules & Engineering Constitution

> Version: 1.0
> Project: FinWise AI – Intelligent Loan Eligibility, Credit Analysis & Financial Advisory Platform
> Owner: Siva Balaji
> Architecture Lead: ChatGPT
> Implementation Assistant: Claude Code
> Last Updated: July 2026

---

# 1. Identity

## Project Identity

FinWise AI is a production-inspired AI-powered fintech web application developed as part of the SmartBridge Vibe Coding Internship. The project is designed to simulate a modern Financial Intelligence Platform while also serving as a high-quality portfolio project.

The application combines traditional financial calculations with Generative AI to help users evaluate loan eligibility, analyze credit scores, calculate EMIs, assess financial risk, and receive personalized financial recommendations.

---

## Team Roles

### Product Owner
Siva Balaji

Responsible for:
- Product vision
- Final decision making
- Reviewing all generated code
- Testing features
- Managing GitHub repository
- Deployment

---

### Software Architect
ChatGPT

Responsible for:
- System architecture
- Folder structure
- Prompt engineering
- Feature planning
- UI planning
- Code review guidance
- Documentation strategy

---

### AI Implementation Engineer
Claude Code

Responsible ONLY for:
- Writing code
- Refactoring when requested
- Fixing bugs
- Creating components
- Following every rule in this document

Claude MUST NOT:

- Change project architecture without instruction.
- Rename folders or files without approval.
- Rewrite working code unless requested.
- Change the UI design on its own.
- Introduce unnecessary dependencies.
- Remove existing functionality without permission.

---

## Primary Objectives

The project must satisfy all three goals simultaneously.

### Goal 1 — Internship Success

Successfully complete every SmartBridge internship requirement including:

- Loan Eligibility Checker
- Credit Score Analyzer
- EMI Calculator
- AI Financial Advisor
- Google Sheets Integration
- Responsive UI
- Deployment
- Documentation

---

### Goal 2 — Portfolio Quality

The application should look and behave like a modern AI SaaS product suitable for showcasing on GitHub, LinkedIn, and a professional resume.

---

### Goal 3 — Learning

Every implementation should help the Product Owner understand:

- Astro
- TypeScript
- Tailwind CSS v4
- AI Integration
- Prompt Engineering
- Component Architecture
- Modern Frontend Development

The project should prioritize clean architecture and maintainability over shortcuts.

---

## Development Philosophy

Think First.

Design Second.

Build Third.

Test Fourth.

Deploy Fifth.

Improve Forever.

Every feature must be planned before implementation.
---

# 2. Project Mission & Technical Vision

## Project Mission

The mission of FinWise AI is to build a modern AI-powered Financial Intelligence Platform that helps users make informed financial decisions through intelligent analysis, accurate calculations, and personalized recommendations.

The platform must combine traditional financial formulas with Generative AI to provide fast, reliable, and user-friendly financial assistance.

This project has three equally important goals:

1. Successfully satisfy every SmartBridge internship requirement.
2. Become a portfolio-quality AI application suitable for GitHub, LinkedIn, and a professional resume.
3. Follow production-level software engineering practices using modern frontend technologies.

---

## Technical Stack (Locked)

Framework:
- Astro

Language:
- TypeScript

Styling:
- Tailwind CSS v4

AI Provider:
- Groq

Primary Model:
- llama-3.3-70b-versatile

Icons:
- Lucide

Database:
- Google Sheets

Backend:
- Google Apps Script

Deployment:
- Vercel

Version Control:
- Git + GitHub

Package Manager:
- npm

---

## Core Features (Locked)

The application must contain the following modules:

- Landing Page
- Financial Intelligence Dashboard
- Loan Eligibility Checker
- Credit Score Analyzer
- EMI Calculator
- AI Financial Advisor
- Financial Risk Assessment
- Loan Recommendation
- Recent Analysis History

No module should be removed unless approved by the Product Owner.

---

## Engineering Principles

Every implementation must follow these principles.

### Keep Components Small

Each component should have one responsibility.

Avoid components larger than necessary.

---

### Reusability First

If code is likely to be reused, create a reusable component or utility instead of duplicating logic.

---

### Business Logic Separation

Financial calculations must never be placed inside UI components.

Business logic belongs in services or utility files.

---

### AI Is an Assistant

AI provides reasoning, explanations, recommendations, and guidance.

AI must NOT replace deterministic financial calculations.

Loan eligibility, EMI calculations, and rule-based validations must always be calculated locally.

---

### Type Safety

Avoid `any`.

Use proper interfaces and types whenever possible.

---

### Performance

Load only what is necessary.

Keep JavaScript bundles small.

Avoid unnecessary hydration.

Follow Astro best practices.

---

### Accessibility

Every form element must include:

- Label
- Placeholder
- Keyboard accessibility
- Visible focus state

The application should be usable by all users.

---

## Success Vision

When a recruiter, mentor, or evaluator opens FinWise AI, the first impression should be:

"This looks like a real AI fintech product, not a student assignment."

---

# 3. Coding Standards

## Folder Structure

Follow the approved feature-based architecture.

```
src/
├── components/
├── features/
│   ├── loan/
│   ├── credit/
│   ├── emi/
│   └── advisor/
├── services/
├── utils/
├── types/
├── layouts/
├── pages/
├── styles/
```

Never create unnecessary folders.

---

## Component Rules

- One responsibility per component.
- Prefer reusable components.
- Avoid duplicate code.
- Keep components small and readable.
- Move shared UI into `components/`.

---

## TypeScript Rules

- Use strict typing.
- Avoid `any`.
- Create interfaces for reusable data.
- Keep business models inside `types/`.

---

## Business Logic

Never place calculations inside UI components.

Move financial logic into services or utility functions.

Examples:

- Loan calculation
- EMI calculation
- Risk calculation

must remain outside UI.

---

## Styling Rules

Use Tailwind CSS v4 only.

Do not use inline CSS.

Use design tokens consistently.

Keep spacing consistent.

---

## AI Rules

AI provides:

- explanations
- recommendations
- financial guidance

AI must never replace deterministic calculations.

---

## Error Handling

Always handle:

- Invalid input
- Empty fields
- API failures
- Network failures
- Google Sheets failures

Display user-friendly error messages.

---

## Code Quality

Every file should be:

- Modular
- Readable
- Reusable
- Maintainable
- Production-ready

