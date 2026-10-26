// Vercel entry: no local files, background timers or listen() calls.
module.exports = require("../server/cloud-app.cjs").createCloudApp();
