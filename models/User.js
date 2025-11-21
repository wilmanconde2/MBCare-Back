import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "El email es obligatorio"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    nombre: {
      type: String,
      required: [true, "El nombre completo es obligatorio"],
      trim: true,
    },

    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      minlength: 8,
    },

    rol: {
      type: String,
      enum: ["Fundador", "Profesional", "Asistente", "Lector"],
      default: "Profesional",
    },

    activo: {
      type: Boolean,
      default: true,
    },

    debeCambiarPassword: {
      type: Boolean,
      default: true,
    },

    organizacion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);
