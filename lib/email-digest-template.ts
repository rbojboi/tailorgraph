import { renderEmailTemplate } from "./email-template";
import type { EmailInput } from "./notifications";

type DigestItem = Pick<EmailInput, "subject" | "text" | "digestSummary" | "digestAction">;

// Older queued emails have only plain text, including navigation URLs. Keep those
// URLs in the text alternative, but never print them inside the HTML summary.
function legacySummary(text: string) {
  return text.split(/\r?\n/).filter(line =>
    !/^\s*(?:https?:\/\/\S+|(?:Email preferences|Reply here|View listing|Review offer|Start with your measurements|Browse the marketplace|Need help\? Visit Support):\s*https?:\/\/\S+)\s*$/i.test(line)
  ).join("\n").trim();
}

export function renderDigestEmail(items: DigestItem[], appUrl: string) {
  const subject = `Your TailorGraph digest · ${items.length} update${items.length === 1 ? "" : "s"}`;
  return {
    subject,
    text: items.map(item => `${item.subject}\n${item.text}`).join("\n\n"),
    html: renderEmailTemplate({
      title: "Your TailorGraph updates",
      optional: true,
      details: items.map(item => ({
        label: item.subject,
        value: item.digestSummary ?? legacySummary(item.text),
        action: item.digestAction
      })),
      primaryAction: items.some(item => !item.digestAction)
        ? { label: "Visit TailorGraph", url: appUrl }
        : undefined
    }, appUrl)
  };
}
