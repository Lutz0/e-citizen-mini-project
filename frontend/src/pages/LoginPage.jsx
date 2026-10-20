import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { LockKeyhole, LogIn, Mail, UserPlus } from "lucide-react";
import { Alert } from "../components/ui/Alert.jsx";
import { Button, ButtonLink } from "../components/ui/Button.jsx";
import { PasswordField, TextField } from "../components/ui/FormFields.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { useForm } from "../hooks/useForm.js";
import { homePathFor } from "../utils/constants.js";
import { applyServerErrors, validateLoginForm } from "../utils/validation.js";

export default function LoginPage() {
  useDocumentTitle("Sign in");
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({ email: "", password: "" }, validateLoginForm);

  async function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget; // keep a handle for after the await
    if (!form.validateAll(formElement)) return;
    setSubmitting(true);
    try {
      const user = await login({ email: form.values.email.trim(), password: form.values.password });
      toast.success(`Welcome back, ${user.full_name.split(" ")[0]}.`);
      const from = location.state?.from;
      navigate(from ? `${from.pathname}${from.search ?? ""}` : homePathFor(user), { replace: true });
    } catch (error) {
      form.showErrors(applyServerErrors(error, ["email", "password"]), formElement);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-2 text-ink-2">Sign in to report issues and follow your requests.</p>
      <p className="mt-1 text-sm text-ink-3">Service administrators sign in here too and are taken to the dashboard.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        {location.state?.from && !form.errors._form && <Alert variant="info">Please sign in to continue.</Alert>}
        {form.errors._form && <Alert variant="error">{form.errors._form}</Alert>}

        <TextField
          label="Email address"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          icon={Mail}
          value={form.values.email}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.errors.email}
          required
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          icon={LockKeyhole}
          value={form.values.password}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.errors.password}
          required
        />
        <Button type="submit" size="lg" icon={LogIn} loading={submitting} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-4 text-sm text-ink-2">
        Forgot your password? Password resets are handled by a service administrator.
      </p>

      <div className="my-8 flex items-center gap-4" role="presentation">
        <span className="h-px flex-1 bg-line" />
        <span className="text-sm text-ink-3">New to the service?</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <ButtonLink to="/register" variant="secondary" size="lg" icon={UserPlus} className="w-full">
        Create a citizen account
      </ButtonLink>
    </>
  );
}
