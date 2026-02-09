import mongoose from "mongoose";
const { Schema } = mongoose;

const WorkerWorkDaySchema = new Schema(
  {
    workerId: { type: Schema.Types.ObjectId, ref: "vendor-users", required: true, index: true },

    dateKey: { type: String, required: true, index: true }, // ✅ REQUIRED

    expectedShift: { type: String, enum: ["A", "C"], required: true },

    actualOutcome: {
      type: String,
      enum: ["A_FULL", "C_FULL", "SUBSHIFT", "ABSENT"],
      required: true,
    },

    onTime: { type: Boolean, default: false },
    safetyCompliant: { type: Boolean, default: true },

    dayWage: { type: Number, default: 0 },
    dayBonus: { type: Number, default: 0 },
    dayTotal: { type: Number, default: 0 },

    checkInAt: { type: Date },
    checkOutAt: { type: Date },
    sourceSessionId: { type: Schema.Types.ObjectId, ref: "AttendanceSession" },

    overrideReason: { type: String, default: "" },
    overrideBy: { type: String, default: "" },
    locked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

WorkerWorkDaySchema.index({ workerId: 1, dateKey: 1 }, { unique: true });

const WorkerWorkDay =
  mongoose.models.WorkerWorkDay || mongoose.model("WorkerWorkDay", WorkerWorkDaySchema);

export default WorkerWorkDay;
