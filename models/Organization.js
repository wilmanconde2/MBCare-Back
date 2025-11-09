import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
  },
  industria: {
    type: String,
    enum: ["Psicología", "CAF/E", "Odontología"],
    required: true,
  },
  logo: {
    type: String,
    default: "",
  },
  tema: {
    type: String,
    enum: ["claro", "oscuro"],
    default: "claro",
  },
  creadaPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, {
  timestamps: true,
});

export default mongoose.model("Organization", organizationSchema);
