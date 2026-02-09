import fetch from "node-fetch";

export function normalizeMobile10(m) {
    return String(m || "").replace(/\D/g, "").slice(-10);
}

export async function sendInteraktTemplate({
    phone10,
    countryCode = "+91",
    templateName,
    languageCode = "en",
    bodyValues = [],
    headerValues,
    buttonValues,
    buttonPayload,
    callbackData,
    campaignId,
}) {
    const apiKey = process.env.INTERAKT_API_KEY;
    if (!apiKey) throw new Error("INTERAKT_API_KEY missing");

    if (!templateName) throw new Error("templateName missing");
    if (!phone10 || String(phone10).length !== 10) throw new Error(`Invalid phone10: ${phone10}`);

    const payload = {
        countryCode,
        phoneNumber: phone10,
        type: "Template",
        callbackData: callbackData || "",
        template: {
            name: templateName,
            languageCode,
            bodyValues,
        },
    };

    if (campaignId) payload.campaignId = campaignId;
    if (Array.isArray(headerValues)) payload.template.headerValues = headerValues;
    if (buttonValues && typeof buttonValues === "object") payload.template.buttonValues = buttonValues;
    if (buttonPayload && typeof buttonPayload === "object") payload.template.buttonPayload = buttonPayload;

    const res = await fetch("https://api.interakt.ai/v1/public/message/", {
        method: "POST",
        headers: {
            Authorization: `Basic ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || json?.result === false) {
        throw new Error(json?.message || `Interakt failed (${res.status})`);
    }

    return json;
}
