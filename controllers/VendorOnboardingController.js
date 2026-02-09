import VendorUsers from "../models/VendorUsers.js";
import { computeWorkerBadge } from "../utils/workerBadge.js";

/**
 * ONBOARDING STEPS (single source of truth)
 */
export const ONBOARDING_STEPS = {
    HOME: "HOME",
    PROFILE: "PROFILE",
    SKILLS: "SKILLS",
    CITY: "CITY",
    SELFIE: "SELFIE",
    AADHAAR: "AADHAAR",
    PAN: "PAN",
    CONSENT: "CONSENT",
    SUBMITTED: "SUBMITTED",
};

// -------------------------
// Skills catalog (your existing)
// -------------------------
const SKILL_CATALOG = {
    construction: [
        { key: "civil_mason", subs: ["brickwork", "blockwork", "plastering", "pcc_bed", "concrete_finishing"] },
        { key: "rcc_shuttering_carpenter", subs: ["slab_shuttering", "beam_column_shuttering", "centering_supports", "shuttering_fixing", "dismantling_cleaning"] },
        { key: "steel_bar_bender", subs: ["cutting_bending", "tying_spacing", "stirrups_rings", "basic_bbs", "rebar_placement"] },
        { key: "plumber", subs: ["pipeline_layout", "water_supply", "drainage_lines", "bathroom_fittings", "leak_fixing"] },
        { key: "electrician", subs: ["concealed_wiring", "db_installation", "switch_socket_points", "lighting_fans", "basic_fault_finding"] },
        { key: "tile_marble_stone", subs: ["floor_tiling", "wall_tiling", "leveling_alignment", "grouting_finishing", "marble_stone_laying"] },
        { key: "painter", subs: ["wall_prep_putty", "primer_paint", "texture_finish_coats", "exterior_weathercoat", "touchup_finishing"] },
        { key: "fabricator_welder", subs: ["ms_fabrication", "grill_gate_railing", "arc_welding", "gas_welding", "site_fixing_installation"] },
        { key: "flooring_specialist", subs: ["ips_flooring", "vitrified_base_prep", "kota_stone_flooring", "polishing_finishing", "screed_leveling"] },
        { key: "site_supervisor", subs: ["team_coordination", "work_allocation_reporting", "quality_checks", "basic_measurements", "safety_material_tracking"] },
    ],
    interior: [
        { key: "modular_carpenter", subs: ["modular_kitchen_install", "wardrobe_install", "tv_unit_panels", "hardware_hinges_channels", "finishing_alignment"] },
        { key: "false_ceiling_pop", subs: ["gypsum_grid_install", "pop_punning", "cove_lighting_cutouts", "ceiling_leveling", "ceiling_finishing"] },
        { key: "interior_painter", subs: ["wall_putty_sanding", "primer_basecoat", "interior_paint_finish", "texture_designer_finish", "final_touchups"] },
        { key: "tile_marble_stone", subs: ["floor_tiling", "wall_tiling", "leveling_alignment", "grouting_finishing", "marble_stone_laying"] },
        { key: "electrician", subs: ["concealed_wiring", "db_installation", "switch_socket_points", "lighting_fans", "basic_fault_finding"] },
        { key: "plumber", subs: ["pipeline_layout", "water_supply", "drainage_lines", "bathroom_fittings", "leak_fixing"] },
        { key: "aluminium_upvc", subs: ["sliding_windows", "openable_windows", "partition_frames", "mesh_fitting", "silicon_seal_alignment"] },
        { key: "glass_partition", subs: ["toughened_glass_fixing", "shower_partition", "glass_door_hardware", "sealant_finishing", "alignment_safety"] },
        { key: "hvac_ac", subs: ["ac_indoor_outdoor_mount", "copper_piping_insulation", "drain_pipe_slope", "vacuum_gas_charging", "testing_commissioning"] },
        { key: "wallpaper_decor", subs: ["wall_smoothing_base", "wallpaper_pasting", "edge_corner_finish", "wall_panels_install", "final_cleaning"] },
    ],
};

// -------------------------
// ✅ Helpers (robust)
// -------------------------
function isPlainObj(v) {
    return v && typeof v === "object" && !Array.isArray(v);
}

function uniq(arr) {
    return Array.from(new Set((arr || []).filter(Boolean).map(String)));
}

function normalizeMap(input) {
    // { mainKey: [subKey...] } -> sanitized + deduped
    if (!isPlainObj(input)) return {};
    const out = {};
    for (const k of Object.keys(input)) {
        const subs = Array.isArray(input[k]) ? uniq(input[k]) : [];
        if (subs.length) out[String(k)] = subs;
    }
    return out;
}

function buildCatalogMap(catalogArr = []) {
    // [{key, subs}] -> { key: [subs...] }
    const out = {};
    for (const item of catalogArr) {
        if (!item?.key || !Array.isArray(item.subs)) continue;
        out[String(item.key)] = item.subs.map(String);
    }
    return out;
}

const SKILL_CATALOG_MAP = {
    construction: buildCatalogMap(SKILL_CATALOG.construction),
    interior: buildCatalogMap(SKILL_CATALOG.interior),
};

function validateAgainstCatalog(domain, skillsMap) {
    const cat = SKILL_CATALOG_MAP?.[domain] || {};
    const cleaned = {};

    for (const mainKey of Object.keys(skillsMap || {})) {
        const allowed = cat[mainKey];
        if (!Array.isArray(allowed)) continue;

        const allowedSet = new Set(allowed);
        const subs = (skillsMap[mainKey] || [])
            .map(String)
            .filter((s) => allowedSet.has(s));

        if (subs.length) cleaned[mainKey] = uniq(subs);
    }

    return cleaned;
}

function toPlainObj(maybeMapOrObj) {
    // Mongoose Map can come as Map in-memory, or plain object in JSON
    if (!maybeMapOrObj) return {};
    if (maybeMapOrObj instanceof Map) return Object.fromEntries(maybeMapOrObj.entries());
    if (isPlainObj(maybeMapOrObj)) return maybeMapOrObj;
    return {};
}

function deriveMainSkillsFromV2(v2) {
    const keys = [];
    for (const domain of ["construction", "interior"]) {
        const m = v2?.[domain] || {};
        for (const k of Object.keys(m)) {
            if (Array.isArray(m[k]) && m[k].length) keys.push(k);
        }
    }
    return uniq(keys);
}

function deriveDomainsFromV2(v2) {
    const domains = [];
    for (const domain of ["construction", "interior"]) {
        const m = v2?.[domain] || {};
        const hasAny = Object.keys(m).some((k) => Array.isArray(m[k]) && m[k].length);
        if (hasAny) domains.push(domain);
    }
    return domains;
}

/**
 * PROFILE
 * POST /onboarding/profile
 */
export const updateProfile = async (req, res) => {
    const { fullName, profilePhotoUrl, preferredLanguage } = req.body;

    const user = await VendorUsers.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.readOnly) return res.status(403).json({ success: false, message: "Profile is under review" });

    user.profile = user.profile || {};

    if (fullName?.trim()) user.profile.fullName = fullName.trim();
    if (profilePhotoUrl) user.profile.photoUrl = profilePhotoUrl;
    if (["en", "hi", "mr"].includes(preferredLanguage)) {
        user.profile.preferredLanguage = preferredLanguage;
    }

    user.onboardingStep = ONBOARDING_STEPS.SKILLS;
    await user.save();

    res.json({
        success: true,
        onboardingStep: user.onboardingStep,
        next: computeVendorNext(user),
    });
};

// -------------------------
// ✅ updateSkills controller (supports v2 + legacy)
// POST /onboarding/skills
// -------------------------
export const updateSkills = async (req, res) => {
    try {
        const { skillsV2, skills, tab, skillsMap } = req.body;

        const user = await VendorUsers.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (user.readOnly) return res.status(403).json({ success: false, message: "Profile is under review" });

        // ensure container (works even if schema is loose)
        user.skillsV2 = user.skillsV2 || { construction: {}, interior: {} };

        // -------------------------
        // ✅ CASE 1: V2 full payload
        // { skillsV2: { construction: {main:[subs...]}, interior:{...} } }
        // -------------------------
        if (isPlainObj(skillsV2)) {
            const incoming = {
                construction: validateAgainstCatalog("construction", normalizeMap(skillsV2.construction)),
                interior: validateAgainstCatalog("interior", normalizeMap(skillsV2.interior)),
            };

            const main = deriveMainSkillsFromV2(incoming);
            if (!main.length) {
                return res.status(400).json({ success: false, message: "Select at least one sub-skill" });
            }

            user.skillsV2.construction = incoming.construction;
            user.skillsV2.interior = incoming.interior;

            // Backward compatible fields
            user.skills = main;
            user.skillsDomains = deriveDomainsFromV2(incoming);

            user.onboardingStep = ONBOARDING_STEPS.CITY;
            await user.save();

            return res.json({
                success: true,
                onboardingStep: user.onboardingStep,
                next: computeVendorNext(user),
                skillsV2: user.skillsV2,
                skills: user.skills,
                skillsDomains: user.skillsDomains,
            });
        }

        // -------------------------
        // ✅ CASE 2: tab-based partial update (optional)
        // { tab:"construction", skillsMap:{ plumber:["..."] } }
        // -------------------------
        const domain = tab === "interior" ? "interior" : "construction";
        const validated = validateAgainstCatalog(domain, normalizeMap(skillsMap));
        const legacyMain = Array.isArray(skills) ? uniq(skills) : [];

        const hasSubs = Object.keys(validated).length > 0;
        if (!hasSubs && legacyMain.length === 0) {
            return res.status(400).json({ success: false, message: "Select at least one skill" });
        }

        // overwrite only that domain
        user.skillsV2[domain] = validated;

        // derive from current stored V2
        const currentV2 = {
            construction: toPlainObj(user.skillsV2.construction),
            interior: toPlainObj(user.skillsV2.interior),
        };

        const derivedMain = deriveMainSkillsFromV2(currentV2);
        user.skills = derivedMain.length ? derivedMain : legacyMain;
        user.skillsDomains = deriveDomainsFromV2(currentV2);

        user.onboardingStep = ONBOARDING_STEPS.CITY;
        await user.save();

        return res.json({
            success: true,
            onboardingStep: user.onboardingStep,
            next: computeVendorNext(user),
            skillsV2: user.skillsV2,
            skills: user.skills,
            skillsDomains: user.skillsDomains,
        });
    } catch (error) {
        console.log("updateSkills error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * CITY
 * POST /onboarding/city
 */
export const updateCity = async (req, res) => {
    try {
        const { city } = req.body;

        const user = await VendorUsers.findById(req.user._id);
        console.log(user);

        if (!user) return res.status(404).json({ success: false });

        if (!city) {
            return res.status(400).json({ success: false, message: "City is required" });
        }

        user.city = String(city);
        user.onboardingStep = ONBOARDING_STEPS.SELFIE;

        await user.save();

        res.json({
            success: true,
            onboardingStep: user.onboardingStep,
            next: computeVendorNext(user),
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * SELFIE
 * POST /onboarding/selfie
 */
export const submitSelfie = async (req, res) => {
    const { selfieUrl } = req.body;

    const user = await VendorUsers.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false });

    if (!selfieUrl) {
        return res.status(400).json({ success: false, message: "Selfie required" });
    }

    user.kyc = user.kyc || {};
    user.profile.photoUrl = selfieUrl;
    user.onboardingStep = ONBOARDING_STEPS.AADHAAR;

    await user.save();

    res.json({
        success: true,
        onboardingStep: user.onboardingStep,
        next: computeVendorNext(user),
    });
};

/**
 * AADHAAR
 * POST /onboarding/aadhaar
 */
export const submitAadhaar = async (req, res) => {
    try {
        const { aadhaarFrontUrl, aadhaarBackUrl } = req.body;

        console.log(aadhaarFrontUrl);
        console.log(aadhaarBackUrl);

        const user = await VendorUsers.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false });

        if (!aadhaarFrontUrl || !aadhaarBackUrl) {
            return res.status(400).json({ success: false, message: "Aadhaar front & back required" });
        }

        user.kyc = user.kyc || {};
        user.kyc.aadhaarFrontUrl = aadhaarFrontUrl;
        user.kyc.aadhaarBackUrl = aadhaarBackUrl;
        user.onboardingStep = ONBOARDING_STEPS.PAN;

        await user.save();

        res.json({
            success: true,
            onboardingStep: user.onboardingStep,
            next: computeVendorNext(user),
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PAN
 * POST /onboarding/pan
 */
export const submitPan = async (req, res) => {
    const { panUrl } = req.body;

    const user = await VendorUsers.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false });

    if (!panUrl) {
        return res.status(400).json({ success: false, message: "PAN required" });
    }

    user.kyc = user.kyc || {};
    user.kyc.panUrl = panUrl;
    user.onboardingStep = ONBOARDING_STEPS.CONSENT;

    await user.save();

    res.json({
        success: true,
        onboardingStep: user.onboardingStep,
        next: computeVendorNext(user),
    });
};

/**
 * CONSENT
 * POST /onboarding/consent
 */
export const acceptConsent = async (req, res) => {
    try {
        const { agreeTerms, agreePrivacy, agreeWhatsapp = false, version = "v1" } = req.body;

        const user = await VendorUsers.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false });
        if (!agreeTerms || !agreePrivacy) {
            return res.status(400).json({ success: false, message: "Consent required" });
        }

        user.consent = {
            termsAccepted: true,
            privacyAccepted: true,
            acceptedAt: new Date(),
        };

        user.onboardingStep = ONBOARDING_STEPS.CONSENT;
        await user.save();

        res.json({ success: true });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * FINAL SUBMIT
 * POST /onboarding/submit
 */
export const submitOnboarding = async (req, res) => {
    try {
        const user = await VendorUsers.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false });
        if (user.readOnly) return res.status(403).json({ success: false });

        user.onboardingStep = ONBOARDING_STEPS.SUBMITTED;
        user.approvalStatus = "PENDING";
        user.readOnly = true;

        await user.save();

        res.json({
            success: true,
            onboardingStep: user.onboardingStep,
            approvalStatus: user.approvalStatus,
            next: computeVendorNext(user),
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ME
 * GET /me
 */
export const me = async (req, res) => {
    const user = await VendorUsers.findById(req.user._id).select("-otp -otpExpiresAt");
    if (!user) return res.status(404).json({ success: false });

    const badge = computeWorkerBadge({
        skillCategory: user.skillCategory,
        skillLevel: user.skillLevel,
    });

    res.json({
        success: true,
        user,
        badge,
        next: computeVendorNext(user),

        // ✅ optional helpers (safe)
        skillsV2: user.skillsV2 || { construction: {}, interior: {} },
        skillsDomains: user.skillsDomains || [],
    });
};

/**
 * NEXT SCREEN RESOLVER
 */
export function computeVendorNext(user) {
    if (user.approvalStatus === "APPROVED") return { screen: "AppTabsNavigator" };

    switch (user.onboardingStep) {
        case ONBOARDING_STEPS.PROFILE:
        case ONBOARDING_STEPS.HOME:
            return { screen: "Onboarding" };
        case ONBOARDING_STEPS.SKILLS:
            return { screen: "OnboardingSkills" };
        case ONBOARDING_STEPS.CITY:
            return { screen: "OnboardingCity" };
        case ONBOARDING_STEPS.SELFIE:
            return { screen: "OnboardingSelfie" };
        case ONBOARDING_STEPS.AADHAAR:
            return { screen: "OnboardingAadhaar" };
        case ONBOARDING_STEPS.PAN:
            return { screen: "OnboardingPAN" };
        case ONBOARDING_STEPS.CONSENT:
            return { screen: "OnboardingConsent" };
        case ONBOARDING_STEPS.SUBMITTED:
            return { screen: "OnboardingReview" };
        default:
            return { screen: "Onboarding" };
    }
}
