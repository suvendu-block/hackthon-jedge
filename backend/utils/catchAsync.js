/// catchAsync — wrap async controllers so rejections reach the error middleware
/// usage: export const x = catchAsync(async (req, res, next) => { ... })
const catchAsync = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export default catchAsync;
