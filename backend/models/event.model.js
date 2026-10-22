import mongoose from 'mongoose';

// one criterion inside an event's rubric
// weight is a percentage — the controller/schema enforce Σ = 100
const criterionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxlength: 80,
        trim: true
    },
    description: {
        type: String,
        maxlength: 300,
        trim: true,
        default: ''
    },
    weight: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    }
}, { _id: true });   // criteria get ids so scorecards can reference them later

/// events schema
const eventSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxlength: 100,
        trim: true
    },
    description: {
        type: String,
        maxlength: 1000,
        trim: true,
        default: ''
    },
    // organizer owns the event — only they can edit it
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // judges invited to score submissions in this event
    judges: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // the rubric — judged against this. Σ weights = 100 (checked on save)
    rubric: {
        type: [criterionSchema],
        default: [],
        validate: {
            validator: (rubric) => {
                if (rubric.length === 0) return true;   // draft can start empty
                const total = rubric.reduce((sum, c) => sum + c.weight, 0);
                return Math.abs(total - 100) < 0.001;   // float tolerance
            },
            message: 'Rubric weights must add up to 100'
        }
    },
    // draft → published → closed. published locks the rubric
    status: {
        type: String,
        enum: ['draft', 'published', 'closed'],
        default: 'draft'
    },
    // standings stay sealed until the organizer lets them out (Phase 5).
    // only meaningful once status is 'closed' — release requires it.
    resultsReleased: {
        type: Boolean,
        default: false
    },
    releasedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

const Event = mongoose.model('Event', eventSchema);

export default Event;
