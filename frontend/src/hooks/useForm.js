import { useCallback, useState } from "react";

/**
 * Minimal form state manager.
 *
 * - `validate(values)` returns `{ field: "message" }` (empty object when valid).
 * - Fields are validated when the user leaves them and again on submit; a
 *   field's error clears as soon as they start correcting it.
 * - On a failed submit, focus jumps to the first invalid field.
 * - Server-side errors can be merged in with `setErrors` (see applyServerErrors).
 */
export function useForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const clearError = useCallback((name) => {
    setErrors((current) => {
      if (!current[name] && !current._form) return current;
      const { [name]: _removed, _form: _formError, ...rest } = current;
      return rest;
    });
  }, []);

  const setValue = useCallback(
    (name, value) => {
      setValues((current) => ({ ...current, [name]: value }));
      clearError(name);
    },
    [clearError],
  );

  const handleChange = useCallback((event) => setValue(event.target.name, event.target.value), [setValue]);

  const handleBlur = useCallback(
    (event) => {
      const { name } = event.target;
      const message = validate(values)[name];
      setErrors((current) => {
        if (message) return { ...current, [name]: message };
        const { [name]: _removed, ...rest } = current;
        return rest;
      });
    },
    [validate, values],
  );

  const focusFirstInvalid = useCallback((formElement) => {
    // Wait for React to render aria-invalid before looking for it.
    setTimeout(() => {
      const invalid = formElement?.querySelector('[aria-invalid="true"]');
      // A radio group is invalid as a whole: focus its checked (or first) option.
      const target = invalid?.matches("fieldset")
        ? invalid.querySelector("input:checked") || invalid.querySelector("input")
        : invalid;
      target?.focus();
    }, 0);
  }, []);

  /** Validate everything; returns true when the form can be submitted. Pass the <form> element so focus can move to the first problem. */
  const validateAll = useCallback(
    (formElement) => {
      const found = validate(values);
      setErrors(found);
      if (Object.keys(found).length) {
        focusFirstInvalid(formElement);
        return false;
      }
      return true;
    },
    [validate, values, focusFirstInvalid],
  );

  /** Show errors returned by the server and focus the first offending field. */
  const showErrors = useCallback(
    (found, formElement) => {
      setErrors(found);
      focusFirstInvalid(formElement);
    },
    [focusFirstInvalid],
  );

  return { values, errors, handleChange, handleBlur, setValue, setErrors, showErrors, validateAll };
}
