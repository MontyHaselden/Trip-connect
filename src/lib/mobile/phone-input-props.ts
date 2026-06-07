/** Props that stop mobile browsers autofill from putting an email in the phone field. */
export const phoneInputProps = {
  type: "tel" as const,
  inputMode: "tel" as const,
  autoComplete: "tel",
  autoCorrect: "off",
  autoCapitalize: "off" as const,
  spellCheck: false,
  name: "phone",
};
