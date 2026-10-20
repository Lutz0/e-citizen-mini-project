import { useState } from "react";
import { useNavigate } from "react-router";
import { LockKeyhole, LogIn, Mail, Phone, User, UserPlus } from "lucide-react";
import { Alert } from "../components/ui/Alert.jsx";
import { Button, ButtonLink } from "../components/ui/Button.jsx";
import { PasswordField, TextField } from "../components/ui/FormFields.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { useForm } from "../hooks/useForm.js";
import { applyServerErrors, validateRegisterForm } from "../utils/validation.js";

const FIELDS = ["full_name", "email", "phone_number", "password", "password_confirm"];

export default function RegisterPage() {
  useDocumentTitle("Create an account");
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm(
    { full_name: "", email: "", phone_number: "", password: "", password_confirm: "" },
    validateRegisterForm,
  );

  async function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget; // keep a handle for after the await
    if (!form.validateAll(formElement)) return;
    setSubmitting(true);
    try {
      const { values } = form;
      const user = await register({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        phone_number: values.phone_number.trim(),
        password: values.password,
        password_confirm: values.password_confirm,
      });
      toast.success(`Your account is ready, ${user.full_name.split(" ")[0]}. You can report your first issue now.`);
      navigate("/requests", { replace: true });
    } catch (error) {
      form.showErrors(applyServerErrors(error, FIELDS), formElement);
    } finally {
      setSubmitting(false);
    }
  }

  const bind = (name) => ({
    name,
    value: form.values[name],
    onChange: form.handleChange,
    onBlur: form.handleBlur,
    error: form.errors[name],
  });

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-ink">Create your account</h1>
      <p className="mt-2 text-ink-2">Report community issues and follow them until they're fixed.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        {form.errors._form && <Alert variant="error">{form.errors._form}</Alert>}

        <TextField label="Full name" autoComplete="name" icon={User} {...bind("full_name")} />
        <TextField label="Email address" type="email" inputMode="email" autoComplete="email" icon={Mail} {...bind("email")} />
        <TextField
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          icon={Phone}
          optional
          hint="Used only if the service team needs to reach you about your request."
          {...bind("phone_number")}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          icon={LockKeyhole}
          hint="At least 8 characters. Avoid common passwords and all-number passwords."
          {...bind("password")}
        />
        <PasswordField label="Confirm password" autoComplete="new-password" icon={LockKeyhole} {...bind("password_confirm")} />

        <Button type="submit" size="lg" icon={UserPlus} loading={submitting} className="w-full">
          Create account
        </Button>
      </form>

      <div className="my-8 flex items-center gap-4" role="presentation">
        <span className="h-px flex-1 bg-line" />
        <span className="text-sm text-ink-3">Already registered?</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <ButtonLink to="/login" variant="secondary" size="lg" icon={LogIn} className="w-full">
        Sign in to your account
      </ButtonLink>
    </>
  );
}
