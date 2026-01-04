// mbcare-backend/models/Organization.js

import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    industria: {
      type: String,
      enum: ["Psicología", "CAF/E", "Odontología"],
      required: true,
    },

    tema: {
      type: String,
      enum: ["claro", "oscuro"],
      default: "claro",
    },

    creadaPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Organization", organizationSchema);
