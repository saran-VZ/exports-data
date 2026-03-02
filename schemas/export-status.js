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
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    scheduledFor: {
      type: Date,
      default: null,
      index: true,
    },

    fileFormat: {
      type: String,
      default: "xlsx",
    },

    filePath: {
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

    errorMessage: {
      type: String,
      default: null,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true, 
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
);

//ExportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("exportStatus", ExportSchema);