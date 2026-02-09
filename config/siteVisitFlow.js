export const SITE_VISIT_FLOW = {
    tn_sitevisit_confirm_v1: {
        "Yes, confirm": "tn_sitevisit_call_slots_v1",
        "No, not now": "tn_sitevisit_nudge_v1",
        "Reschedule": "tn_sitevisit_reschedule_v1",
        "Cancel": "tn_sitevisit_cancelled_v1",
    },

    tn_sitevisit_call_slots_v1: {
        "Ready now": "tn_sitevisit_budget_v1",
        "In 1 hour": "tn_sitevisit_budget_v1",
        "Later today": "tn_sitevisit_budget_v1",
        "Choose a different time": "tn_sitevisit_custom_time_v1",
    },

    tn_sitevisit_custom_time_v1: {
        "Morning (10–12)": "tn_sitevisit_budget_v1",
        "Afternoon (12–3)": "tn_sitevisit_budget_v1",
        "Evening (3–6)": "tn_sitevisit_budget_v1",
        "Tomorrow": "tn_sitevisit_budget_v1",
    },

    tn_sitevisit_budget_v1: {
        "₹50 Lakhs – ₹1 Crore": "tn_sitevisit_timeline_v1",
        "₹1 Crore – ₹2 Crore": "tn_sitevisit_timeline_v1",
        "₹2 Crore – ₹3.5 Crore": "tn_sitevisit_timeline_v1",
        "Above ₹3.5 Crore": "tn_sitevisit_timeline_v1",
    },

    tn_sitevisit_timeline_v1: {
        "Immediately": "tn_sitevisit_decision_v1",
        "1–3 months": "tn_sitevisit_decision_v1",
        "3–6 months": "tn_sitevisit_decision_v1",
        "6+ months": "tn_sitevisit_decision_v1",
    },

    tn_sitevisit_decision_v1: {
        "I am the decision maker": "tn_sitevisit_summary_proceed_v1",
        "Joint family decision": "tn_sitevisit_summary_proceed_v1",
        "Decision later": "tn_sitevisit_summary_proceed_v1",
        "Just exploring": "tn_sitevisit_summary_proceed_v1",
    },

    tn_sitevisit_summary_proceed_v1: {
        "Proceed": "tn_sitevisit_proceed_ack_v1",
        "Edit details": "tn_sitevisit_call_slots_v1",
        "Cancel": "tn_sitevisit_cancelled_v1",
    },

    tn_sitevisit_nudge_v1: {
        "Continue now": "tn_sitevisit_call_slots_v1",
    },

    tn_sitevisit_reschedule_v1: {
        "Today": "tn_sitevisit_call_slots_v1",
        "Tomorrow": "tn_sitevisit_call_slots_v1",
        "This weekend": "tn_sitevisit_call_slots_v1",
        "Choose time": "tn_sitevisit_custom_time_v1",
    },

    tn_sitevisit_cancelled_v1: {
        "Restart": "tn_sitevisit_confirm_v1",
    },
};
