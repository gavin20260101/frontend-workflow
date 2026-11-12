# Frontend quality supplement

Use this checklist when adding frontend-specific requirements to a plan. For a Superpowers plan, add the results to that same plan under `## Frontend quality supplement (frontend-workflow)` (older plans may use the previous heading `## Frontend quality supplement (req-workflow)`; treat it as the same section and rename it when updating). For an independent frontend-workflow plan, place applicable items in its existing sections. Do not create a second design or implementation plan.

Keep only items that apply to the change:

- **Acceptance criteria:** give each user-visible behavior an AC ID and a clear expected result.
- **UI states:** include the affected loading, empty, error, validation, disabled, and success states.
- **Responsive and accessible behavior:** name the supported viewport/device classes that matter; include keyboard/focus, semantic labels, contrast, and reduced motion when the change affects them.
- **Compatibility and analytics:** note changed shared interfaces, persisted data, supported app/WebView versions, and analytics events only where relevant.
- **Verification:** map each AC to the lowest useful existing test layer. Name test cases and existing commands. Add browser checks for behavior that needs a real rendered page; reserve device-specific manual steps for behavior the emulator cannot represent.
- **Risk and rollback:** record only concrete risks introduced by this change and a practical rollback path.

Use the project's existing test framework and conventions. Do not add dependencies as part of this supplement. Choose devices and scenarios based on supported platforms, changed code, and risk; do not multiply every scenario across every device by default. If no suitable automated test exists, say why and specify the manual check.

For browser checks, use the frontend-workflow browser services and safety rules when available. Test only local or approved test environments, use isolated test accounts/data, and require explicit confirmation before actions that could affect real users or funds. Screenshots and other disposable evidence may remain in the local ignored artifact directory; keep the plan itself alongside the Superpowers plan so task workers can read it.
