import { useState } from "react";
import { useNavigate } from "react-router";
import { Send } from "lucide-react";
import { createRequest } from "../../api/requests.js";
import { Container, PageHeader } from "../../components/layout/Page.jsx";
import { ImagePicker } from "../../components/requests/ImagePicker.jsx";
import { Alert } from "../../components/ui/Alert.jsx";
import { Button, ButtonLink } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { TextAreaField, TextField } from "../../components/ui/FormFields.jsx";
import { RadioCards } from "../../components/ui/RadioCards.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { useForm } from "../../hooks/useForm.js";
import { CATEGORIES, SEVERITIES } from "../../utils/constants.js";
import { applyServerErrors, LIMITS, validateImageFile, validateRequestForm } from "../../utils/validation.js";

const FIELDS = ["category", "location", "description", "severity", "image"];

export default function NewRequestPage() {
  useDocumentTitle("Report an issue");
  const navigate = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm(
    { category: "", location: "", description: "", severity: "medium", image: null },
    validateRequestForm,
  );
  const { values, errors } = form;

  // Check the photo the moment it is chosen; an unusable file is never kept or previewed.
  function handlePhotoChange(file) {
    const message = validateImageFile(file);
    if (message) {
      form.setErrors((current) => ({ ...current, image: message }));
      return;
    }
    form.setValue("image", file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget; // keep a handle for after the await
    if (!form.validateAll(formElement)) return;
    setSubmitting(true);
    try {
      const created = await createRequest({
        ...values,
        location: values.location.trim(),
        description: values.description.trim(),
      });
      toast.success(`Request ${created.reference} submitted.`);
      navigate(`/requests/${created.reference}`, { state: { justCreated: created.reference } });
    } catch (error) {
      form.showErrors(applyServerErrors(error, FIELDS), formElement);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container narrow className="py-8">
      <PageHeader
        back={{ to: "/requests", label: "Back to my requests" }}
        title="Report an issue"
        description="Tell us what's wrong and where. The more detail you give, the faster the team can act."
      />

      <Card className="p-5 sm:p-7">
        <form onSubmit={handleSubmit} noValidate className="space-y-7">
          {errors._form && <Alert variant="error" title="Your request couldn't be submitted">{errors._form}</Alert>}

          <RadioCards
            legend="What kind of problem is it?"
            name="category"
            value={values.category}
            onChange={form.setValue}
            options={CATEGORIES}
            columns="grid-cols-2 sm:grid-cols-3"
            stacked
            error={errors.category}
          />

          <TextField
            label="Where is it?"
            name="location"
            autoComplete="off"
            hint="A street address, estate, area or a nearby landmark."
            value={values.location}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={errors.location}
            maxLength={LIMITS.locationMax + 20}
          />

          <TextAreaField
            label="What is the problem?"
            name="description"
            rows={5}
            hint="Describe what you see, how long it has been happening and why it matters."
            value={values.description}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={errors.description}
            counter={{
              text: `${values.description.trim().length}/${LIMITS.descriptionMax}`,
              over: values.description.trim().length > LIMITS.descriptionMax,
            }}
          />

          <RadioCards
            legend="How serious is it?"
            hint="This helps the team decide what to deal with first."
            name="severity"
            value={values.severity}
            onChange={form.setValue}
            options={SEVERITIES}
            columns="grid-cols-1 sm:grid-cols-3"
            compact
            error={errors.severity}
          />

          <ImagePicker file={values.image} error={errors.image} onChange={handlePhotoChange} />

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
            <ButtonLink to="/requests" variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit" size="lg" icon={Send} loading={submitting}>
              Submit request
            </Button>
          </div>
        </form>
      </Card>
    </Container>
  );
}
