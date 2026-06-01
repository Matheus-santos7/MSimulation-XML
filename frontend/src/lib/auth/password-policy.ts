/** Regras espelhadas no backend (`passwordField`) — só para feedback na UI. */
export const PASSWORD_POLICY_HINT =
  "Mín. 8 caracteres, com maiúscula, minúscula e número";

export function passwordPolicyIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push("ao menos 8 caracteres");
  if (!/[a-z]/.test(password)) issues.push("uma letra minúscula");
  if (!/[A-Z]/.test(password)) issues.push("uma letra maiúscula");
  if (!/[0-9]/.test(password)) issues.push("um número");
  if (["password", "12345678", "senha123", "demo123"].includes(password.toLowerCase())) {
    issues.push("evite senhas muito comuns");
  }
  return issues;
}

export function isPasswordPolicyValid(password: string): boolean {
  return passwordPolicyIssues(password).length === 0;
}
