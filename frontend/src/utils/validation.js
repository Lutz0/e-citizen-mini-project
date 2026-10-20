/**
 * Client-side form validation.
 *
 * These rules mirror the backend serializers so people get instant feedback,
 * but the server remains the authority - it re-validates everything, and its
 * messages are shown too (see `applyServerErrors`).
 *
 * Every validator returns an error message, or "" when the value is fine.
 */
export const LIMITS = {
  nameMin: 2,
  nameMax: 150,
  passwordMin: 8,
  locationMin: 3,
  locationMax: 255,
  descriptionMin: 10,
  descriptionMax: 2000,
  noteMax: 500,
  commentMax: 1000,
  imageMaxBytes: 5 * 1024 * 1024,
};

export const IMAGE_TYPES = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] };
export const IMAGE_ACCEPT = Object.keys(IMAGE_TYPES).join(",");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,19}$/;

export function validateEmail(value) {
  const email = value.trim();
  if (!email) return "Please enter your email address.";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address, like name@example.com.";
  return "";
}

export function validateFullName(value) {
  const name = value.trim();
  if (!name) return "Please enter your full name.";
  if (name.length < LIMITS.nameMin) return "Please enter your full name.";
  if (name.length > LIMITS.nameMax) return `Your name can be at most ${LIMITS.nameMax} characters.`;
  return "";
}

export function validatePhone(value) {
  const phone = value.trim();
  if (!phone) return ""; // optional
  return PHONE_PATTERN.test(phone) ? "" : "Enter a valid phone number, for example 0712 345 678.";
}

export function validateNewPassword(value) {
  if (!value) return "Please choose a password.";
  if (value.length < LIMITS.passwordMin) return `Use at least ${LIMITS.passwordMin} characters.`;
  if (/^\d+$/.test(value)) return "Your password can't be only numbers.";
  return "";
}

export function validatePasswordConfirm(password, confirm) {
  if (!confirm) return "Please confirm your password.";
  return password === confirm ? "" : "The two passwords do not match.";
}

export function validateRequired(value, message) {
  return String(value ?? "").trim() ? "" : message;
}

export function validateLocation(value) {
  const location = value.trim();
  if (!location) return "Tell us where the problem is - an address, area or landmark.";
  if (location.length < LIMITS.locationMin) return "Please give a little more detail about the location.";
  if (location.length > LIMITS.locationMax) return `The location can be at most ${LIMITS.locationMax} characters.`;
  return "";
}

export function validateDescription(value) {
  const description = value.trim();
  if (!description) return "Please describe the problem.";
  if (description.length < LIMITS.descriptionMin) {
    return `Please describe the problem in at least ${LIMITS.descriptionMin} characters.`;
  }
  if (description.length > LIMITS.descriptionMax) {
    return `The description can be at most ${LIMITS.descriptionMax} characters.`;
  }
  return "";
}

export function validateImageFile(file) {
  if (!file) return "";
  const extension = file.name.includes(".") ? `.${file.name.split(".").pop().toLowerCase()}` : "";
  const allowedExtensions = Object.values(IMAGE_TYPES).flat();
  if (!IMAGE_TYPES[file.type] || !allowedExtensions.includes(extension)) {
    return "Unsupported file type. Please choose a JPEG, PNG or WebP image.";
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > LIMITS.imageMaxBytes) {
    return `That image is too large. The maximum size is ${LIMITS.imageMaxBytes / (1024 * 1024)} MB.`;
  }
  return "";
}

// --- Form-level validators -------------------------------------------------

const compact = (errors) => Object.fromEntries(Object.entries(errors).filter(([, message]) => message));

export function validateLoginForm({ email, password }) {
  return compact({
    email: validateEmail(email),
    password: validateRequired(password, "Please enter your password."),
  });
}

export function validateRegisterForm({ full_name, email, phone_number, password, password_confirm }) {
  return compact({
    full_name: validateFullName(full_name),
    email: validateEmail(email),
    phone_number: validatePhone(phone_number),
    password: validateNewPassword(password),
    password_confirm: validatePasswordConfirm(password, password_confirm),
  });
}

export function validateRequestForm({ category, location, description, image }) {
  return compact({
    category: validateRequired(category, "Select a category."),
    location: validateLocation(location),
    description: validateDescription(description),
    image: validateImageFile(image),
  });
}

/**
 * Merge an ApiError's field errors into the shape the forms use ({ field: message }).
 * Server errors for fields the form doesn't know about are returned under `_form`.
 */
export function applyServerErrors(apiError, knownFields) {
  const result = {};
  Object.entries(apiError.errors || {}).forEach(([field, messages]) => {
    const message = Array.isArray(messages) ? messages[0] : String(messages);
    if (knownFields.includes(field)) result[field] = message;
    else result._form = result._form ? `${result._form} ${message}` : message;
  });
  if (!Object.keys(result).length) result._form = apiError.detail;
  return result;
}
