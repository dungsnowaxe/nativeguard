import {
  type PrReviewReport,
  validatePrReviewReport
} from "@nativeguard/schema";

export interface RenderPrReviewCommentOptions {
  repository?: string;
  baseRef?: string;
  headRef?: string;
}

export function renderPrReviewComment(
  report: PrReviewReport,
  options: RenderPrReviewCommentOptions = {}
): string {
  const validation = validatePrReviewReport(report);
  if (!validation.valid) {
    throw new Error(`Invalid PR review report: ${validation.errors.join(", ")}`);
  }

  const lines: string[] = [
    "## NativeGuard Stability Check",
    "",
    `Status: **${report.status.toUpperCase()}**`,
    `Project: ${formatProject(report.project)}`,
    formatRefLine(options),
    "",
    "### Changed Packages",
    ...formatChangedPackages(report),
    "",
    "### New Risks",
    ...formatFindings(report),
    "",
    "### Required Actions",
    ...formatActions(report),
    "",
    "### Verification",
    ...formatVerification(report)
  ];

  return `${lines.filter(line => line !== undefined).join("\n")}\n`;
}

function formatProject(project: PrReviewReport["project"]): string {
  const parts = [
    project.kind,
    project.expoVersion ? `Expo ${project.expoVersion}` : undefined,
    project.reactNativeVersion ? `React Native ${project.reactNativeVersion}` : undefined,
    project.packageManager
  ].filter(Boolean);

  return parts.join(" · ");
}

function formatRefLine(options: RenderPrReviewCommentOptions): string {
  const refs = [
    options.repository,
    options.baseRef && options.headRef ? `${options.baseRef}...${options.headRef}` : undefined
  ].filter(Boolean);

  return refs.length > 0 ? `Context: ${refs.join(" · ")}` : "Context: local comparison";
}

function formatChangedPackages(report: PrReviewReport): string[] {
  if (report.changedPackages.length === 0) {
    return ["- No package changes detected."];
  }

  return report.changedPackages.map(node => `- \`${node.packageName}@${node.installedVersion}\` (${node.direct ? "direct" : "transitive"})`);
}

function formatFindings(report: PrReviewReport): string[] {
  if (report.newRisks.length === 0) {
    return ["- No new risks detected."];
  }

  return report.newRisks.map(finding => {
    const rule = finding.ruleId ? ` via \`${finding.ruleId}\`` : "";
    return `- **${finding.severity}** ${finding.title}${rule}: ${finding.detail}`;
  });
}

function formatActions(report: PrReviewReport): string[] {
  if (report.requiredActions.length === 0) {
    return ["- No required actions."];
  }

  return report.requiredActions.map(action => {
    const target = action.packageName ? ` \`${action.packageName}\`` : "";
    const version = action.to ? ` -> \`${action.to}\`` : "";
    return `- ${action.type}${target}${version}: ${action.note}`;
  });
}

function formatVerification(report: PrReviewReport): string[] {
  if (report.verificationChecklist.length === 0) {
    return ["- No additional verification required."];
  }

  return report.verificationChecklist.map(item => `- ${item}`);
}
