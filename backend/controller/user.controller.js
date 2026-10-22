import User from '../models/user.model.js';
import catchAsync from '../utils/catchAsync.js';

/// list judges — organizers need this to fill the "assign judge" dropdown
/// (no passwords, no tokens — just id + name + email)
export const listJudges = catchAsync(async (req, res) => {
    const judges = await User.find({ role: 'judge' })
        .select('name email')
        .sort('name');

    res.json(judges);
});
