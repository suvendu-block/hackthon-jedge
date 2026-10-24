import mongoose from 'mongoose';

/// RepoGrant — proof the team authorized access to their repository (M7).
/// holds AES-GCM ciphertext of their read token, never the raw value, and
/// never leaves the server; revoke wipes the ciphertext and stamps revokedAt
/// so the record of permission outlives the permission itself.
const repoGrantSchema = new mongoose.Schema({
    submission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Submission',
        required: true,
        unique: true
    },
    // parsed from the submission's repositoryUrl when the grant was made
    owner: { type: String, required: true, maxlength: 100 },
    repo: { type: String, required: true, maxlength: 100 },
    visibility: { type: String, enum: ['public', 'private'], required: true },
    // public = server's own read; team-token = the team handed us a token
    authorizedVia: { type: String, enum: ['public', 'team-token'], required: true },
    encryptedToken: { type: String, default: null, select: false },
    // short display id ("granted as tok_1a2b…") — not usable as a secret
    tokenFingerprint: { type: String, default: null, maxlength: 20 },
    scopes: { type: [String], default: [] },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    revokedAt: { type: Date, default: null }
}, { timestamps: true });

const RepoGrant = mongoose.model('RepoGrant', repoGrantSchema);

export default RepoGrant;
