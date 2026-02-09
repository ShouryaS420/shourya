// server/src/utils/deriveUiState.js

/**
 * Returns one of:
 * 'new_user' | 'lead' | 'proposal' | 'active_project' | 'post_handover'
 *
 * Also gently updates user.currentPhase for the main milestones:
 *  - new user / lead       → "Lead"
 *  - active construction   → "Construction KickOff"
 */
export function deriveUiState(user = {}) {
    const cds = Array.isArray(user.constructionDetails) ? user.constructionDetails : [];
    const latest = cds[cds.length - 1] || {};

    const rawPhase = user.currentPhase || '';
    const stage = String(rawPhase).toLowerCase();
    const status = String(latest.status || '').toLowerCase();
    const hasAny = cds.length > 0;

    const isPhaseEmpty = !rawPhase || rawPhase === '-' || rawPhase === 'na';

    // 0) Never started anything → treat as Lead phase for UI
    if (!hasAny) {
        if (isPhaseEmpty) {
            // ⬅️ when a brand new user logs in
            user.currentPhase = 'Lead';
        }
        return 'new_user';
    }

    // 1) Explicit handover / completion
    if (
        stage.includes('handover') ||
        status === 'handover' ||
        latest.handoverCompleted
    ) {
        // Optional: you can also set this if you want a nicer label
        if (isPhaseEmpty) {
            user.currentPhase = 'Post Handover';
        }
        return 'post_handover';
    }

    // 2) Active construction / started project
    if (
        latest.finalApproved ||
        latest.approved ||
        status.includes('construction') ||
        status.includes('work in progress') ||
        status.includes('executing') ||
        status.includes('started') ||
        user.startProject
    ) {
        // ⬅️ when project is actually started
        if (
            isPhaseEmpty ||
            stage.includes('lead') ||        // was 'Lead' before, now lowercase-safe
            stage.includes('proposal')
        ) {
            user.currentPhase = 'Construction KickOff';
        }
        return 'active_project';
    }

    // 3) Proposal / quotation phase
    if (
        stage.includes('estimate') ||           // "Estimate & Quotation"
        stage.includes('quotation') ||
        stage.includes('proposal') ||
        status.includes('connecting rm') ||
        status.includes('discussion') ||
        status.includes('awaiting approval')
    ) {
        if (isPhaseEmpty) {
            user.currentPhase = 'Proposal & Quotation';
        }
        return 'proposal';
    }

    // 4) Pure lead phase (no request sent yet, or still pending)
    if (
        stage.includes('lead') ||              // ✅ fixed lowercase check
        status === 'lead' ||
        status === 'pending' ||
        (!latest.requested && !latest.approved && !latest.finalApproved)
    ) {
        if (isPhaseEmpty) {
            user.currentPhase = 'Lead';
        }
        return 'lead';
    }

    // 5) Fallback → treat as proposal, safer than forcing active
    if (isPhaseEmpty) {
        user.currentPhase = 'Proposal & Quotation';
    }
    return 'proposal';
}
