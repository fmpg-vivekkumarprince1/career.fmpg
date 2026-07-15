const mongoose = require('mongoose');
const documentSchema = new mongoose.Schema({ type: String, number: { type: String, select: false }, url: String, expiresAt: Date, status: { type: String, enum: ['pending', 'verified', 'rejected', 'expired'], default: 'pending' }, verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, verifiedAt: Date }, { _id: true });
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, employeeCode: { type: String, required: true, unique: true, index: true }, departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }, designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' }, managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  employmentType: { type: String, enum: ['full_time', 'part_time', 'contract', 'intern', 'consultant'], default: 'full_time' }, joiningDate: Date, confirmationDate: Date, workLocation: String, employmentStatus: { type: String, enum: ['onboarding', 'active', 'on_notice', 'terminated', 'resigned', 'relieved'], default: 'onboarding', index: true },
  personalInfo: { dateOfBirth: Date, nationality: String, address: mongoose.Schema.Types.Mixed }, emergencyContact: mongoose.Schema.Types.Mixed,
  bankInfo: { accountHolderName: String, accountNumber: { type: String, select: false }, bankName: String, ifscCode: { type: String, select: false }, accountType: String, branch: String }, documents: [documentSchema], currentSalaryStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryStructure' }, sourceApplicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' }, sourceOfferLetterId: { type: mongoose.Schema.Types.ObjectId, ref: 'OfferLetter' }, sourceContractId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmploymentContract' }
}, { timestamps: true });
schema.index({ departmentId: 1, employmentStatus: 1 });
module.exports = mongoose.model('Employee', schema);
