const mongoose = require("mongoose");

const ExportSchema = new mongoose.Schema(
  {
    user_name: {
      type: String,
      required: true,
    },

    collections: {
      type: [String],
      required: true,
    },

    email: {
      type: String,
      default: null,
      required: true,
    },

    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: [
        "pending",
        "queued",
        "processing",
        "completed",
        "failed",
        "expired",
      ],
      default: "pending",
      index: true,
    },

    scheduled_for: {
      type: Date,
      default: null,
      index: true,
    },
    bull_job_id: {
    type: String,
    default: null,
    },

    file_format: {
      type: String,
      default: "xlsx",
    },

    file_path: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      default: null,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    error_logs: {
  type: [
    {
      attempt: { type: Number },
      message: { type: String },
    }
  ],
  default: [],
},

    attempts: {
      type: Number,
      default: 0,
    },

    started_at: {
      type: Date,
      default: null,
    },

    completed_at: {
      type: Date,
      default: null,
    },

    expires_at: {
      type: Date,
      default: null,
      index: true,
    },
  },{
  timestamps: {
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  versionKey: false
}
);

//ExportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("exportStatus", ExportSchema);