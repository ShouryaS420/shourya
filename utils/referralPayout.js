// utils/referralPayout.js
export function isEligibleForOneShot({ startedAt, receipts, contract }) {
    return Boolean(startedAt) && Number(receipts) >= 0.2 * Number(contract);
}

export function computePayout({ contract, rate, cap }) {
    const gross = Number(contract) * Number(rate);
    const amount = Math.min(gross, cap ?? gross);
    return Math.max(0, Math.round(amount));
}

// small helper to append events
export function pushEvent(doc, type, by = "system", notes = "") {
    doc.events.push({ type, at: new Date(), by, notes });
}
