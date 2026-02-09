// controllers/AdminLeadershipProgramController.js
import LeadershipProgram from "../models/LeadershipProgram.js";

export async function adminListLeadershipPrograms(req, res) {
    const programs = await LeadershipProgram.find({})
        .sort({ createdAt: -1 })
        .lean();
    return res.json({ success: true, programs });
}

export async function adminUpsertLeadershipProgram(req, res) {
    const { id } = req.params;

    const payload = req.body || {};

    if (!payload.title || String(payload.title).trim().length < 3) {
        return res.status(400).json({ success: false, message: "title is required" });
    }

    let program;
    if (id === "new") {
        program = await LeadershipProgram.create(payload);
    } else {
        program = await LeadershipProgram.findByIdAndUpdate(id, payload, { new: true });
    }

    return res.json({ success: true, program });
}

export async function adminPublishLeadershipProgram(req, res) {
    const { id } = req.params;
    const program = await LeadershipProgram.findById(id);
    if (!program) return res.status(404).json({ success: false, message: "Program not found" });

    program.status = "PUBLISHED";
    await program.save();

    return res.json({ success: true, program });
}

export async function adminArchiveLeadershipProgram(req, res) {
    const { id } = req.params;
    const program = await LeadershipProgram.findById(id);
    if (!program) return res.status(404).json({ success: false, message: "Program not found" });

    program.status = "ARCHIVED";
    await program.save();

    return res.json({ success: true, program });
}
