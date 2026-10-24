import mongoose from 'mongoose';

/// DemoCheck — server-side liveness check of the team's demo link. the result
/// (reachable, HTTP status, page title) is verified evidence; failures are
/// recorded too, because "demo link is dead" is exactly what judges need to know.
const demoCheckSchema = new mongoose.Schema({
    submission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Submission',
        required: true
    },
    url: { type: String, required: true, maxlength: 500 },
    reachable: { type: Boolean, required: true },
    httpStatus: { type: Number, default: null },
    title: { type: String, default: null, maxlength: 150 },
    // guard failures (SSRF block, timeout, oversized) land here, never fatal
    error: { type: String, default: null, maxlength: 300 },
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

demoCheckSchema.index({ submission: 1, createdAt: -1 });

const DemoCheck = mongoose.model('DemoCheck', demoCheckSchema);

export default DemoCheck;
