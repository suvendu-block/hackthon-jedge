import mongoose from 'mongoose';

/// RepositoryInsight — what the SERVER saw when it looked at the team's repo:
/// metadata, language split, static tree stats, README excerpt. This is the
/// raw material for verified-evidence rows. never executes anything
/// (ADR-0012); versions accumulate per submission like AIAnalysis does.
const repositoryInsightSchema = new mongoose.Schema({
    submission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Submission',
        required: true
    },
    owner: { type: String, required: true, maxlength: 100 },
    repo: { type: String, required: true, maxlength: 100 },
    visibility: { type: String, enum: ['public', 'private'], required: true },
    // how the read was authorized: public repo, team token, or server token
    fetchedVia: { type: String, enum: ['public', 'team-token', 'server-token'], required: true },
    facts: {
        fullName: { type: String, default: '' },
        visibility: { type: String, default: '' },
        stars: { type: Number, default: 0 },
        forks: { type: Number, default: 0 },
        license: { type: String, default: null },
        defaultBranch: { type: String, default: '' },
        createdAt: { type: String, default: '' },
        pushedAt: { type: String, default: '' },
        sizeKB: { type: Number, default: 0 },
        languages: [{
            _id: false,
            name: String,
            bytes: Number
        }],
        treeStats: {
            _id: false,
            totalFiles: Number,
            topExtensions: [{
                _id: false,
                extension: String,
                count: Number
            }],
            testLikeFiles: Number,
            hasCI: Boolean,
            hasDocs: Boolean,
            hasDockerfile: Boolean,
            hasManifest: Boolean,
            truncated: Boolean
        },
        readmeExcerpt: { type: String, default: '' }
    },
    // per-piece failures (no README, languages blocked…) — reported, not fatal
    fetchNotes: { type: [String], default: [] },
    fetchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

repositoryInsightSchema.index({ submission: 1, createdAt: -1 });

const RepositoryInsight = mongoose.model('RepositoryInsight', repositoryInsightSchema);

export default RepositoryInsight;
