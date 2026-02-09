import mongoose from "mongoose";
import AttendanceLocation from "../models/AttendanceLocation.js";
import VendorUsers from "../models/VendorUsers.js";

async function run() {
    await mongoose.connect("mongodb+srv://meshouryanarwade:Shourya%402007@cluster0.b6z4nz9.mongodb.net/99squarewall-database?retryWrites=true&w=majority", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    // 1) Backfill geo for locations missing geo
    const locs = await AttendanceLocation.find({ isActive: { $in: [true, false] } });
    let geoFixed = 0;

    for (const l of locs) {
        const ok = l.geo?.type === "Point" && Array.isArray(l.geo?.coordinates) && l.geo.coordinates.length === 2;
        if (!ok) {
            l.geo = { type: "Point", coordinates: [l.lng, l.lat] };
            await l.save();
            geoFixed++;
        }
    }

    // 2) Ensure attendancePolicy exists on vendors
    const vendors = await VendorUsers.find({});
    let policyFixed = 0;

    for (const v of vendors) {
        if (!v.attendancePolicy) {
            v.attendancePolicy = { requireAssignment: true };
            await v.save();
            policyFixed++;
        } else if (v.attendancePolicy.requireAssignment === undefined) {
            v.attendancePolicy.requireAssignment = true;
            await v.save();
            policyFixed++;
        }
    }

    console.log("DONE", { geoFixed, policyFixed });
    process.exit(0);
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
