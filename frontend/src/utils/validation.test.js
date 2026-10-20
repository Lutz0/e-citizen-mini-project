import { describe, expect, it } from "vitest";
import {
  applyServerErrors,
  validateDescription,
  validateEmail,
  validateFullName,
  validateImageFile,
  validateLocation,
  validateLoginForm,
  validateNewPassword,
  validatePasswordConfirm,
  validatePhone,
  validateRegisterForm,
  validateRequestForm,
} from "./validation.js";

const file = (name, type, size = 1000) => ({ name, type, size });

describe("field validators", () => {
  it("validates email addresses", () => {
    expect(validateEmail("")).toMatch(/enter your email/i);
    expect(validateEmail("nope")).toMatch(/valid email/i);
    expect(validateEmail("a@b")).toMatch(/valid email/i);
    expect(validateEmail("  amina@example.com ")).toBe("");
  });

  it("validates names", () => {
    expect(validateFullName("")).not.toBe("");
    expect(validateFullName("A")).not.toBe("");
    expect(validateFullName("x".repeat(151))).not.toBe("");
    expect(validateFullName("Amina Hassan")).toBe("");
  });

  it("treats the phone number as optional but checks its format", () => {
    expect(validatePhone("")).toBe("");
    expect(validatePhone("0712 345 678")).toBe("");
    expect(validatePhone("+254 712-345-678")).toBe("");
    expect(validatePhone("abc")).not.toBe("");
    expect(validatePhone("12")).not.toBe("");
  });

  it("enforces password rules that mirror the server", () => {
    expect(validateNewPassword("")).not.toBe("");
    expect(validateNewPassword("short1!")).toMatch(/at least 8/);
    expect(validateNewPassword("12345678")).toMatch(/only numbers/);
    expect(validateNewPassword("long-enough-1")).toBe("");
  });

  it("checks the confirmation matches", () => {
    expect(validatePasswordConfirm("abc12345", "")).not.toBe("");
    expect(validatePasswordConfirm("abc12345", "abc12346")).toMatch(/do not match/);
    expect(validatePasswordConfirm("abc12345", "abc12345")).toBe("");
  });

  it("validates location and description lengths after trimming", () => {
    expect(validateLocation("   ")).not.toBe("");
    expect(validateLocation("ab")).toMatch(/more detail/);
    expect(validateLocation("x".repeat(256))).toMatch(/255/);
    expect(validateLocation("Moi Avenue")).toBe("");

    expect(validateDescription("")).not.toBe("");
    expect(validateDescription("too short")).toMatch(/at least 10/);
    expect(validateDescription("x".repeat(2001))).toMatch(/2000/);
    expect(validateDescription("The streetlight is broken.")).toBe("");
  });
});

describe("image validation", () => {
  it("accepts JPEG, PNG and WebP", () => {
    expect(validateImageFile(file("a.jpg", "image/jpeg"))).toBe("");
    expect(validateImageFile(file("a.JPEG", "image/jpeg"))).toBe("");
    expect(validateImageFile(file("a.png", "image/png"))).toBe("");
    expect(validateImageFile(file("a.webp", "image/webp"))).toBe("");
  });

  it("treats no file as fine (the photo is optional)", () => {
    expect(validateImageFile(null)).toBe("");
  });

  it("rejects other types, missing extensions and oversize files", () => {
    expect(validateImageFile(file("a.gif", "image/gif"))).toMatch(/unsupported/i);
    expect(validateImageFile(file("a.svg", "image/svg+xml"))).toMatch(/unsupported/i);
    expect(validateImageFile(file("a.exe", "application/octet-stream"))).toMatch(/unsupported/i);
    expect(validateImageFile(file("noextension", "image/png"))).toMatch(/unsupported/i);
    expect(validateImageFile(file("a.png", "image/png", 0))).toMatch(/empty/i);
    expect(validateImageFile(file("a.png", "image/png", 5 * 1024 * 1024 + 1))).toMatch(/too large/i);
    expect(validateImageFile(file("a.png", "image/png", 5 * 1024 * 1024))).toBe("");
  });
});

describe("form validators", () => {
  it("reports only the fields with problems", () => {
    expect(validateLoginForm({ email: "", password: "" })).toEqual({
      email: expect.any(String),
      password: expect.any(String),
    });
    expect(validateLoginForm({ email: "a@b.co", password: "x" })).toEqual({});
  });

  it("validates a registration", () => {
    const valid = {
      full_name: "Amina Hassan",
      email: "a@b.co",
      phone_number: "",
      password: "long-enough-1",
      password_confirm: "long-enough-1",
    };
    expect(validateRegisterForm(valid)).toEqual({});
    expect(Object.keys(validateRegisterForm({ ...valid, password_confirm: "other" }))).toEqual(["password_confirm"]);
  });

  it("validates a service request", () => {
    const valid = { category: "water", location: "Kibera", description: "No water for four days now.", image: null };
    expect(validateRequestForm(valid)).toEqual({});
    expect(
      Object.keys(validateRequestForm({ ...valid, category: "", location: "", description: "" })).sort(),
    ).toEqual(["category", "description", "location"]);
    expect(validateRequestForm({ ...valid, image: file("a.gif", "image/gif") })).toHaveProperty("image");
  });
});

describe("applyServerErrors", () => {
  it("maps known fields and collects the rest under _form", () => {
    const error = { detail: "Fix it", errors: { email: ["Taken."], password: ["Too weak.", "Other"], mystery: ["Odd."] } };
    expect(applyServerErrors(error, ["email", "password"])).toEqual({
      email: "Taken.",
      password: "Too weak.",
      _form: "Odd.",
    });
  });

  it("falls back to the summary when there are no field errors", () => {
    expect(applyServerErrors({ detail: "Invalid email or password.", errors: {} }, ["email"])).toEqual({
      _form: "Invalid email or password.",
    });
  });
});
