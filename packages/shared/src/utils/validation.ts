export interface PasswordCheckResult {
  valid: boolean
  errors: string[]
  checks: { label: string; passed: boolean }[]
}

const RULES: { label: string; regex: RegExp }[] = [
  { label: '长度不少于8位', regex: /.{8,}/ },
  { label: '包含大写字母', regex: /[A-Z]/ },
  { label: '包含小写字母', regex: /[a-z]/ },
  { label: '包含数字', regex: /[0-9]/ },
  { label: '包含特殊字符', regex: /[!@#$%^&*()_+\-=\[\]{}|;':",./<>?]/ },
]

export function validatePassword(pwd: string): PasswordCheckResult {
  const checks = RULES.map(r => ({ label: r.label, passed: r.regex.test(pwd) }))
  const errors = checks.filter(c => !c.passed).map(c => c.label)
  return { valid: errors.length === 0, errors, checks }
}
