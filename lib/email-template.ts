type EmailAction = { label: string; url: string };

export type EmailLayoutInput = {
  eyebrow?: string;
  title: string;
  preview?: string;
  introParagraphs?: string[];
  /** Only trusted template markup; escape any user content before inserting. */
  bodyHtml?: string;
  details?: Array<{ label: string; value: string; action?: EmailAction }>;
  primaryAction?: EmailAction;
  secondaryAction?: EmailAction;
  footerMessage?: string;
  optional?: boolean;
};

export function escapeEmailHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function emailUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return escapeEmailHtml(url.href);
  } catch { /* Invalid URLs must not become executable links in mail clients. */ }
  return "#";
}

/** Table layout and inline styles keep the core design usable in Outlook and with CSS stripped. */
function renderAction(action: EmailAction, secondary = false) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:${secondary ? "14" : "24"}px;"><tr><td>
<a class="button" href="${emailUrl(action.url)}" style="display:inline-block;background:${secondary ? "#fcfcfa" : "#6e3521"};border:1px solid #6e3521;border-radius:8px;color:${secondary ? "#6e3521" : "#ffffff"};padding:14px 22px;font-size:14px;line-height:20px;font-weight:600;text-decoration:none;mso-padding-alt:0;"><!--[if mso]><i style="mso-font-width:150%;mso-text-raise:22pt;" hidden>&emsp;</i><![endif]--><span style="mso-text-raise:11pt;">${escapeEmailHtml(action.label)}</span><!--[if mso]><i style="mso-font-width:150%;" hidden>&emsp;</i><![endif]--></a>
</td></tr></table>`;
}

export function renderEmailTemplate(input: EmailLayoutInput, appUrl: string) {
  const e = escapeEmailHtml;
  const details = (input.details ?? []).map(detail => `
    <tr><td style="padding:13px 16px;border-bottom:1px solid #e5ded5;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1.3px;text-transform:uppercase;color:#6e6258;">${e(detail.label)}</p>
      <p style="margin:0;font-size:16px;line-height:24px;color:#1c1712;word-break:break-word;">${e(detail.value)}</p>
      ${detail.action ? renderAction(detail.action) : ""}
    </td></tr>`).join("");
  const action = input.primaryAction;
  const secondary = input.secondaryAction;
  const preview = input.preview ?? input.introParagraphs?.[0] ?? input.title;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${e(input.title)}</title>
<style>@media only screen and (max-width:600px){.outer{padding:16px 8px!important}.content{padding:28px 22px!important}.headline{font-size:29px!important}.button{display:block!important;text-align:center!important}}</style>
</head><body style="margin:0;padding:0;background-color:#f5f1eb;color:#1c1712;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;color:#f5f1eb;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${e(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f1eb"><tr><td class="outer" align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 0 24px;text-align:center;">
  <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
  <td style="vertical-align:middle;padding-right:12px;"><img src="${emailUrl(appUrl + "/brand/tailorgraph-logo.png")}" width="44" height="44" alt="TailorGraph" style="display:block;width:44px;height:44px;border:0;border-radius:8px;"></td>
  <td style="vertical-align:middle;"><a href="${emailUrl(appUrl)}" style="text-decoration:none;color:#1c1712;font:28px Georgia,'Times New Roman',serif;letter-spacing:-0.5px;">TailorGraph</a></td>
  </tr></table>
</td></tr>
<tr><td class="content" bgcolor="#fcfcfa" style="padding:38px 40px;border:1px solid #e5ded5;border-top:3px solid #b45b32;border-radius:16px;">
<p style="margin:0 0 16px;color:#6e3521;font-size:11px;line-height:16px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">${e(input.eyebrow ?? "TailorGraph")}</p>
<h1 class="headline" style="margin:0 0 22px;font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:400;line-height:1.2;letter-spacing:-0.5px;color:#1c1712;">${e(input.title)}</h1>
${(input.introParagraphs ?? []).map(p => `<p style="margin:0 0 14px;font-size:16px;line-height:26px;color:#51473e;">${e(p)}</p>`).join("")}
${input.bodyHtml ?? ""}
${details ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;background:#f5f1eb;border:1px solid #e5ded5;border-radius:10px;">${details}</table>` : ""}
${action ? renderAction(action) : ""}
${secondary ? renderAction(secondary, true) : ""}
</td></tr>
<tr><td style="padding:22px 16px 0;font-size:12px;line-height:20px;color:#6e6258;text-align:center;">
<p style="margin:0 0 10px;">${e(input.footerMessage ?? "A considered wardrobe. A better fit.")}</p>
<p style="margin:0;"><a href="${emailUrl(appUrl + "/support")}" style="color:#6e3521;">Get help</a>
&nbsp;&middot;&nbsp; <a href="${emailUrl(appUrl)}" style="color:#6e3521;">TailorGraph</a>
${input.optional ? `&nbsp;&middot;&nbsp; <a href="${emailUrl(appUrl + "/account/notifications")}" style="color:#6e3521;">Email preferences</a>` : ""}</p>
${input.optional ? '<p style="margin:10px 0 0;">You can turn off this optional email in your notification settings.</p>' : '<p style="margin:10px 0 0;">An update about your TailorGraph account or activity.</p>'}
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
