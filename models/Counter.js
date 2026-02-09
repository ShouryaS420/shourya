// models/Counter.js
import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true }, // e.g. 'estimate'
        seq: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default mongoose.models.Counter || mongoose.model("Counter", CounterSchema);
