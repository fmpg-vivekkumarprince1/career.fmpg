const mongoose = require('mongoose');
const schema = new mongoose.Schema({ name: { type: String, required: true, unique: true, trim: true }, code: { type: String, unique: true, sparse: true, uppercase: true }, headId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, active: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ active: 1, name: 1 });
module.exports = mongoose.model('Department', schema);
