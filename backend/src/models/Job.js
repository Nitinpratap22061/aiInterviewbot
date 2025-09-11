import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  type: String,               // E.g., 'evaluation'
  status: { type: String, default: 'pending' },  // pending → processing → completed
  data: mongoose.Schema.Types.Mixed,  // Input data (e.g., transcript)
  result: mongoose.Schema.Types.Mixed,  // AI Evaluation Result
  createdAt: { type: Date, default: Date.now }
});

export const Job = mongoose.model('Job', jobSchema);
