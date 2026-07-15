const mongoose = require('mongoose');
const schema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, code: { type: String, unique: true, sparse: true, uppercase: true }, departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }, level: String, active: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ departmentId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('Designation', schema);
